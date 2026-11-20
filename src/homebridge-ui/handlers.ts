import * as miio from "node-miio";
import {
  deleteSession,
  loadSession,
  saveSession,
  XiaomiCloud,
  type CloudDevice,
  type CloudSession,
  type MapPoint,
  type QrCode,
  type RoborockMap,
} from "node-miio";

/** The payload of every request: where the session is (the platform's `cloud` option) */
export interface CloudRequest {
  sessionFile?: string;
  server?: string;
}

export interface MapRequest extends CloudRequest {
  ip: string;
  token: string;
}

/** The map, ready to draw in the browser */
export interface MapResponse {
  image: {
    top: number;
    left: number;
    width: number;
    height: number;
    /** One byte per pixel, row by row, base64 */
    pixels: string;
  };
  rooms: Array<{ id: number; name?: string }>;
  robot?: MapPoint;
  charger?: MapPoint;
}

type Cloud = Pick<
  XiaomiCloud,
  "session" | "getDevices" | "getMapFileUrl" | "download"
>;

/** A vacuum, connected locally */
interface MapDevice {
  getCloudMap?: (cloud: Cloud, server: string) => Promise<RoborockMap>;
  getRoomMap?: () => Promise<unknown>;
  destroy(): void;
}

/** What the handlers use from node-miio (replaced in the tests) */
export interface HandlerDeps {
  loadSession(file?: string): Promise<CloudSession | undefined>;
  saveSession(session: CloudSession, file?: string): Promise<void>;
  deleteSession(file?: string): Promise<void>;
  createCloud(session: CloudSession): Cloud;
  loginWithQrCode(onQrCode: (qr: QrCode) => void): Promise<Cloud>;
  connect(ip: string, token: string): Promise<MapDevice>;
}

const defaultDeps: HandlerDeps = {
  loadSession,
  saveSession,
  deleteSession,
  createCloud: (session) => new XiaomiCloud(session),
  loginWithQrCode: (onQrCode) => XiaomiCloud.loginWithQrCode({ onQrCode }),
  connect: (ip, token) =>
    miio.device({ address: ip, token }) as unknown as Promise<MapDevice>,
};

/** The result of the QR login, pushed to the UI once it ends */
export interface LoginResult {
  ok: boolean;
  error?: string;
}

/**
 * The requests of the custom UI (`homebridge-ui/public`).
 *
 * @param push Sends an event to the UI
 * @param deps node-miio (replaced in the tests)
 */
export function createHandlers(
  push: (event: string, data: unknown) => void,
  deps: HandlerDeps = defaultDeps
) {
  /** The account's devices, by session and server: listing them takes a few requests per server */
  const caches = new Map<string, Promise<CloudDevice[]>>();

  async function getCloud(request: CloudRequest) {
    const session = await deps.loadSession(request.sessionFile || undefined);
    if (!session) {
      throw new Error("Log in to the Xiaomi Cloud first.");
    }
    return deps.createCloud(session);
  }

  function listDevices(request: CloudRequest, cloud: Cloud, fresh = false) {
    const key = `${request.sessionFile ?? ""}|${request.server ?? ""}|${cloud.session.userId}`;
    let devices = fresh ? undefined : caches.get(key);
    if (!devices) {
      devices = cloud
        .getDevices(
          request.server
            ? { servers: [request.server as CloudDevice["server"]] }
            : {}
        )
        .catch((err) => {
          caches.delete(key);
          throw err;
        });
      caches.set(key, devices);
    }
    return devices;
  }

  return {
    "/cloud/status": async (request: CloudRequest) => {
      const session = await deps.loadSession(request.sessionFile || undefined);
      return { loggedIn: !!session, userId: session?.userId };
    },

    /**
     * Starts the QR login. Resolves with the QR code, and pushes `cloud-login` ({@link LoginResult}) once the user
     * scanned it (or it timed out).
     */
    "/cloud/login-qr": (request: CloudRequest) =>
      new Promise<QrCode>((resolve, reject) => {
        let shown = false;
        deps
          .loginWithQrCode((qr) => {
            shown = true;
            resolve(qr);
          })
          .then(async (cloud) => {
            await deps.saveSession(
              cloud.session,
              request.sessionFile || undefined
            );
            caches.clear();
            push("cloud-login", { ok: true } satisfies LoginResult);
          })
          .catch((err: Error) => {
            if (!shown) reject(err);
            else
              push("cloud-login", {
                ok: false,
                error: err.message,
              } satisfies LoginResult);
          });
      }),

    "/cloud/logout": async (request: CloudRequest) => {
      await deps.deleteSession(request.sessionFile || undefined);
      caches.clear();
      return { loggedIn: false };
    },

    /** The vacuums of the account, with their tokens */
    "/cloud/devices": async (request: CloudRequest) => {
      const cloud = await getCloud(request);
      // The user asked for them: always fresh
      const devices = await listDevices(request, cloud, true);
      return devices
        .filter(({ model }) => model.includes("vacuum"))
        .map(({ did, name, model, token, localip, server, isOnline }) => ({
          did,
          name,
          model,
          token,
          ip: localip,
          server,
          isOnline,
        }));
    },

    /** The robot's map (Roborock), with the names of its rooms if it has any */
    "/map": async (request: MapRequest): Promise<MapResponse> => {
      if (!request.ip || !request.token) {
        throw new Error("The vacuum needs an IP and a token.");
      }
      const cloud = await getCloud(request);
      const token = request.token.toLowerCase();
      const server =
        request.server ||
        (await listDevices(request, cloud)).find(
          (d) => d.token.toLowerCase() === token || d.localip === request.ip
        )?.server;
      if (!server) {
        throw new Error(
          "This vacuum is not in your Xiaomi account (check its IP and token)."
        );
      }
      const device = await deps.connect(request.ip, request.token);
      try {
        if (typeof device.getCloudMap !== "function") {
          throw new Error(
            "Only Roborock vacuums can download their map, for now."
          );
        }
        const [map, names] = await Promise.all([
          device.getCloudMap(cloud, server),
          roomNames(device),
        ]);
        if (!map.image) throw new Error("The map has no image yet.");
        return {
          image: {
            top: map.image.top,
            left: map.image.left,
            width: map.image.width,
            height: map.image.height,
            pixels: Buffer.from(map.image.pixels).toString("base64"),
          },
          rooms: map.rooms.map(({ id }) => ({ id, name: names.get(id) })),
          robot: map.robot,
          charger: map.charger,
        };
      } finally {
        device.destroy();
      }
    },
  };
}

/**
 * @param device The vacuum
 * @returns The names of the rooms set in the app. Only the ones that look like names: some models return a long
 * numeric ID instead.
 */
async function roomNames(device: MapDevice) {
  const names = new Map<number, string>();
  try {
    const mapping = await device.getRoomMap?.();
    if (Array.isArray(mapping)) {
      for (const [id, name] of mapping as Array<[unknown, unknown]>) {
        if (typeof name === "string" && !/^\d+$/.test(name)) {
          names.set(Number(id), name);
        }
      }
    }
  } catch {
    // Not every model has named rooms
  }
  return names;
}
