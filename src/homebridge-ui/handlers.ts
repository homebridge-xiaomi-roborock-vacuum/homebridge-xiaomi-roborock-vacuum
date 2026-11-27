import * as miio from "node-miio";
import {
  CloudDeviceCache,
  deleteRoborockSession,
  deleteSession,
  loadRoborockSession,
  loadSession,
  RoborockLogin,
  RoborockWebApi,
  saveRoborockSession,
  saveSession,
  XiaomiCloud,
  type RoborockDevice,
  type RoborockSession,
  type CloudServer,
  type CloudSession,
  type MapPoint,
  type QrCode,
  type RoborockMap,
} from "node-miio";
import { readLegacyConfig, removeLegacyBlocks } from "./legacy";

/** The payload of every request: where the session is (the platform's `cloud` option) */
export interface CloudRequest {
  sessionFile?: string;
  server?: string;
}

export interface MapRequest extends CloudRequest {
  ip?: string;
  token?: string;
  /** The device ID: enough on its own, the IP and token are read from the account */
  did?: string;
  /** A robot of a Roborock app account: its map comes from the Roborock account, not the Xiaomi Cloud */
  duid?: string;
  /** Where the Roborock session is (the platform's `roborock.sessionFile`) */
  roborockSessionFile?: string;
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
  "session" | "getDevices" | "getMapFileUrl" | "download" | "getScenes"
>;

/** A vacuum, connected locally */
interface MapDevice {
  getCloudMap?: (cloud: Cloud, server: string) => Promise<RoborockMap>;
  getRoomMap?: () => Promise<unknown>;
  getMaps?: () => Promise<Array<{ id: number; name: string }>>;
  getBackupMaps?: () => Promise<Array<{ id: number; savedAt: Date }>>;
  destroy(): void;
}

/** The scenes of the robot's app (the `scenes` option) */
export interface ScenesResponse {
  /** Which app they come from */
  source: "roborock" | "xiaomi";
  scenes: Array<{ id: string; name: string; enabled: boolean }>;
}

/** The maps the robot can switch to (the `maps` option) */
export interface MapsResponse {
  /** The floors (multi-floor maps) */
  floors: Array<{ id: number; name: string }>;
  /** The map backups (e.g. S5), newest first: identified by when they were saved (ISO 8601) */
  backups: Array<{ savedAt: string }>;
}

/** What the handlers use from node-miio (replaced in the tests) */
export interface HandlerDeps {
  loadSession(file?: string): Promise<CloudSession | undefined>;
  saveSession(session: CloudSession, file?: string): Promise<void>;
  deleteSession(file?: string): Promise<void>;
  createCloud(session: CloudSession): Cloud;
  loginWithQrCode(onQrCode: (qr: QrCode) => void): Promise<Cloud>;
  connect(ip: string, token: string): Promise<MapDevice>;
  loadRoborockSession(file?: string): Promise<RoborockSession | undefined>;
  saveRoborockSession(session: RoborockSession, file?: string): Promise<void>;
  deleteRoborockSession(file?: string): Promise<void>;
  /** Starts a login with a code sent by email (finds the account's region) */
  startRoborockLogin(email: string): Promise<RoborockLoginFlow>;
  getRoborockDevices(session: RoborockSession): Promise<RoborockDevice[]>;
  /** The map of a robot of a Roborock app account, and the names of its rooms (by segment) */
  getRoborockMap(
    session: RoborockSession,
    duid: string,
    ip?: string
  ): Promise<{ map: RoborockMap; names: Map<number, string> }>;
  /** The routines of a robot of a Roborock app account */
  getRoborockRoutines(
    session: RoborockSession,
    duid: string
  ): Promise<Array<{ id: number; name: string; enabled: boolean }>>;
  /** A robot of a Roborock app account, connected (`destroy()` closes its connections) */
  connectRoborock(
    session: RoborockSession,
    duid: string,
    ip?: string
  ): Promise<MapDevice>;
}

/** A Roborock login in progress: the code and the login must come from the same client */
export interface RoborockLoginFlow {
  requestCode(): Promise<void>;
  loginWithCode(code: string): Promise<RoborockSession>;
}

/** The payload of the Roborock requests: where the session is (the platform's `roborock` option) */
export interface RoborockRequest {
  sessionFile?: string;
}

const defaultDeps: HandlerDeps = {
  loadSession,
  saveSession,
  deleteSession,
  createCloud: (session) => new XiaomiCloud(session),
  loginWithQrCode: (onQrCode) => XiaomiCloud.loginWithQrCode({ onQrCode }),
  connect: (ip, token) =>
    miio.device({ address: ip, token }) as unknown as Promise<MapDevice>,
  loadRoborockSession,
  saveRoborockSession,
  deleteRoborockSession,
  startRoborockLogin: (email) => RoborockLogin.start(email),
  getRoborockDevices: (session) => new RoborockWebApi(session).getDevices(),
  getRoborockMap: async (session, duid, ip) => {
    const home = await new RoborockWebApi(session).getHomeData();
    const robot = miio.toDevices(home).find((r) => r.duid === duid);
    if (!robot) throw new Error("This vacuum is not in your Roborock account.");
    const mqtt = new miio.RoborockMqttSession(session.userData.rriot);
    const api = new miio.RoborockDeviceApi({
      ...robot,
      model: robot.model ?? "",
      address: ip || undefined,
      mqtt,
    });
    try {
      // The map comes over MQTT; the room mapping locally when possible
      const [map, mapping] = await Promise.all([
        api.getMap(),
        api.call("get_room_mapping", []).catch(() => []),
      ]);
      const names = new Map<number, string>();
      for (const { segmentId, name } of miio.roomNames(mapping, home.rooms)) {
        if (name) names.set(segmentId, name);
      }
      return { map, names };
    } finally {
      api.close();
      await mqtt.close();
    }
  },
  getRoborockRoutines: (session, duid) =>
    new RoborockWebApi(session).getRoutines(duid),
  connectRoborock: async (session, duid, ip) => {
    const home = await new RoborockWebApi(session).getHomeData();
    const robot = miio.toDevices(home).find((r) => r.duid === duid);
    if (!robot) throw new Error("This vacuum is not in your Roborock account.");
    const mqtt = new miio.RoborockMqttSession(session.userData.rriot);
    try {
      const device = (await miio.roborockDevice({
        ...robot,
        model: robot.model ?? "",
        address: ip || undefined,
        mqtt,
      })) as unknown as MapDevice;
      return {
        getMaps: device.getMaps?.bind(device),
        getBackupMaps: device.getBackupMaps?.bind(device),
        destroy: () => {
          device.destroy();
          void mqtt.close();
        },
      };
    } catch (err) {
      await mqtt.close();
      throw err;
    }
  },
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
  deps: HandlerDeps = defaultDeps,
  /** Homebridge's `config.json` (to move the legacy `accessories` blocks) */
  configPath?: string
) {
  function getConfigPath() {
    if (!configPath) throw new Error("Homebridge's config file is unknown.");
    return configPath;
  }

  /** The Roborock logins waiting for their code, by email */
  const roborockLogins = new Map<string, RoborockLoginFlow>();

  /** The account's devices, by session and server: listing them takes a few requests per server */
  const caches = new Map<string, CloudDeviceCache>();

  async function getCloud(request: CloudRequest) {
    const session = await deps.loadSession(request.sessionFile || undefined);
    if (!session) {
      throw new Error("Log in to the Xiaomi Cloud first.");
    }
    return deps.createCloud(session);
  }

  function deviceCache(request: CloudRequest, cloud: Cloud) {
    const key = `${request.sessionFile ?? ""}|${request.server ?? ""}|${cloud.session.userId}`;
    let cache = caches.get(key);
    if (!cache) {
      cache = new CloudDeviceCache(
        cloud,
        request.server ? { servers: [request.server as CloudServer] } : {}
      );
      caches.set(key, cache);
    }
    return cache;
  }

  /**
   * Connects to the robot: a Roborock-app robot through its account, otherwise locally (with a device ID, the Xiaomi
   * account knows its IP and token).
   */
  async function connectTo(request: MapRequest): Promise<MapDevice> {
    if (request.duid) {
      const session = await deps.loadRoborockSession(
        request.roborockSessionFile || undefined
      );
      if (!session) throw new Error("Log in to your Roborock account first.");
      return deps.connectRoborock(session, request.duid, request.ip);
    }
    if (request.did) {
      const cloud = await getCloud(request);
      const found = await deviceCache(request, cloud).find({
        did: request.did,
      });
      const ip = found?.localip || request.ip;
      const token = found?.token || request.token;
      if (!ip || !token) {
        throw new Error(
          "This vacuum is not in your Xiaomi account (check its device ID)."
        );
      }
      return deps.connect(ip, token);
    }
    if (!request.ip || !request.token) {
      throw new Error("The vacuum needs a device ID, or an IP and a token.");
    }
    return deps.connect(request.ip, request.token);
  }

  return {
    /** The vacuums configured in the legacy `accessories` format, converted to the platform's */
    "/legacy": () => readLegacyConfig(getConfigPath()),

    /** Removes the legacy blocks, once moved to the platform (and saved) */
    "/legacy/remove": ({ blocks }: { blocks: number }) =>
      removeLegacyBlocks(getConfigPath(), blocks),

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
      const cache = deviceCache(request, cloud);
      cache.clear();
      const devices = await cache.list();
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

    "/roborock/status": async (request: RoborockRequest) => {
      const session = await deps.loadRoborockSession(
        request.sessionFile || undefined
      );
      return { loggedIn: !!session, email: session?.email };
    },

    /** Asks Roborock to email a login code to the account */
    "/roborock/request-code": async ({ email }: { email?: string }) => {
      const address = email?.trim();
      if (!address)
        throw new Error("Enter the email of your Roborock account.");
      const login = await deps.startRoborockLogin(address);
      await login.requestCode();
      roborockLogins.set(address.toLowerCase(), login);
      return { sent: true };
    },

    /** Logs in with the code from the email, and saves the session */
    "/roborock/login": async (
      request: RoborockRequest & { email?: string; code?: string }
    ) => {
      const address = request.email?.trim().toLowerCase() ?? "";
      const login = roborockLogins.get(address);
      if (!login) throw new Error("Ask for a code first.");
      const code = request.code?.trim();
      if (!code) throw new Error("Enter the code from the email.");
      const session = await login.loginWithCode(code);
      await deps.saveRoborockSession(session, request.sessionFile || undefined);
      roborockLogins.delete(address);
      return { loggedIn: true, email: session.email };
    },

    "/roborock/logout": async (request: RoborockRequest) => {
      await deps.deleteRoborockSession(request.sessionFile || undefined);
      return { loggedIn: false };
    },

    /** The robots of the Roborock account (without their local keys) */
    "/roborock/devices": async (request: RoborockRequest) => {
      const session = await deps.loadRoborockSession(
        request.sessionFile || undefined
      );
      if (!session) throw new Error("Log in to your Roborock account first.");
      const devices = await deps.getRoborockDevices(session);
      return devices.map(
        ({
          duid,
          name,
          model,
          productName,
          protocolVersion,
          online,
          shared,
        }) => ({
          duid,
          name,
          model,
          productName,
          protocolVersion,
          online,
          shared,
          // The protocols node-miio can control
          supported: /^(1\.0|L01)$/.test(protocolVersion),
        })
      );
    },

    /** The maps the robot can switch to: its floors (multi-floor maps) and its map backups */
    "/maps": async (request: MapRequest): Promise<MapsResponse> => {
      const device = await connectTo(request);
      try {
        // Each model has one kind or the other (or none): a model without one answers an error, or nothing
        const [floors, backups] = await Promise.all([
          device.getMaps?.().catch(() => []) ?? [],
          device.getBackupMaps?.().catch(() => []) ?? [],
        ]);
        return {
          floors,
          backups: backups.map(({ savedAt }) => ({
            savedAt: savedAt.toISOString(),
          })),
        };
      } finally {
        device.destroy();
      }
    },

    /**
     * The scenes of the robot's app: the Roborock app's routines (`duid` robots), or the Xiaomi Home app's manual
     * scenes that use the robot
     */
    "/scenes": async (request: MapRequest): Promise<ScenesResponse> => {
      if (request.duid) {
        const session = await deps.loadRoborockSession(
          request.roborockSessionFile || undefined
        );
        if (!session) throw new Error("Log in to your Roborock account first.");
        const routines = await deps.getRoborockRoutines(session, request.duid);
        return {
          source: "roborock",
          scenes: routines.map(({ id, name, enabled }) => ({
            id: String(id),
            name,
            enabled,
          })),
        };
      }
      if (!request.did && (!request.ip || !request.token)) {
        throw new Error("The vacuum needs a device ID, or an IP and a token.");
      }
      const cloud = await getCloud(request);
      const found = await deviceCache(request, cloud).find({
        did: request.did,
        token: request.token,
        ip: request.ip,
      });
      const server = request.server || found?.server;
      if (!found || !server) {
        throw new Error(
          `This vacuum is not in your Xiaomi account (check its ${request.did ? "device ID" : "IP and token"}).`
        );
      }
      const scenes = await cloud.getScenes(server, { did: found.did });
      return {
        source: "xiaomi",
        scenes: scenes.map(({ id, name, enabled }) => ({ id, name, enabled })),
      };
    },

    /** The robot's map (Roborock), with the names of its rooms if it has any */
    "/map": async (request: MapRequest): Promise<MapResponse> => {
      if (request.duid) {
        const session = await deps.loadRoborockSession(
          request.roborockSessionFile || undefined
        );
        if (!session) throw new Error("Log in to your Roborock account first.");
        const { map, names } = await deps.getRoborockMap(
          session,
          request.duid,
          request.ip
        );
        return toMapResponse(map, names);
      }
      if (!request.did && (!request.ip || !request.token)) {
        throw new Error("The vacuum needs a device ID, or an IP and a token.");
      }
      const cloud = await getCloud(request);
      const found = await deviceCache(request, cloud).find({
        did: request.did,
        token: request.token,
        ip: request.ip,
      });
      const server = request.server || found?.server;
      // With a device ID, the account knows where the robot is now
      const ip = (request.did && found?.localip) || request.ip;
      const token = (request.did && found?.token) || request.token;
      if (!server || !ip || !token) {
        throw new Error(
          `This vacuum is not in your Xiaomi account (check its ${request.did ? "device ID" : "IP and token"}).`
        );
      }
      const device = await deps.connect(ip, token);
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
        return toMapResponse(map, names);
      } finally {
        device.destroy();
      }
    },
  };
}

/**
 * @param map The parsed map
 * @param names The names of its rooms, by segment
 * @returns The map, ready to draw in the browser
 */
function toMapResponse(
  map: RoborockMap,
  names: Map<number, string>
): MapResponse {
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
