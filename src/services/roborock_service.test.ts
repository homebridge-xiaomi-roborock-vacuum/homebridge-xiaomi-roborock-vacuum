import { RoborockSessionExpiredError, type RoborockHomeData } from "node-miio";
import { RoborockService, type RoborockServiceDeps } from "./roborock_service";

const session = {
  email: "me@example.com",
  baseUrl: "https://euiot.roborock.com",
  clientId: "c",
  userData: {
    token: "t",
    rriot: { u: "u", s: "s", h: "h", k: "k", r: { r: "EU", a: "a", m: "m" } },
  },
};

const home: RoborockHomeData = {
  id: 1,
  name: "Home",
  products: [
    { id: "p1", name: "Saros 20", model: "roborock.vacuum.a296" },
    { id: "p2", name: "Q7", model: "roborock.vacuum.sc05" },
  ],
  devices: [
    {
      duid: "duid-1",
      name: "Saros 20 Neo",
      localKey: "key1",
      productId: "p1",
      pv: "1.0",
      fv: "02.32.54",
    },
    {
      duid: "duid-2",
      name: "Q7",
      localKey: "key2",
      productId: "p2",
      pv: "B01",
    },
  ],
  receivedDevices: [],
  rooms: [
    { id: 50625967, name: "Cocina" },
    { id: 50638987, name: "Lavadero" },
  ],
};

function setup(
  options: { session?: typeof session | undefined; homeError?: Error } = {}
) {
  const log = { debug: jest.fn(), info: jest.fn(), warn: jest.fn() };
  const mqtt = { close: jest.fn() };
  const device = { name: "the device" };
  const deps = {
    loadSession: jest.fn(async () =>
      "session" in options ? options.session : session
    ),
    getHomeData: jest.fn(async () => {
      if (options.homeError) throw options.homeError;
      return home;
    }),
    createMqtt: jest.fn(() => mqtt),
    connect: jest.fn(async () => device),
  };
  const service = new RoborockService(
    log,
    { enabled: true, sessionFile: "/roborock.json" },
    deps as unknown as RoborockServiceDeps
  );
  return { service, deps, log, mqtt, device };
}

describe("RoborockService", () => {
  test("connects to a robot of the account, with its local key, model and the shared MQTT session", async () => {
    const { service, deps, mqtt, device } = setup();
    const logger = { debug: jest.fn() };

    const connection = await service.connect({ duid: "duid-1" }, logger);

    expect(deps.loadSession).toHaveBeenCalledWith("/roborock.json");
    expect(deps.connect).toHaveBeenCalledWith({
      duid: "duid-1",
      localKey: "key1",
      model: "roborock.vacuum.a296",
      address: undefined,
      mqtt,
      logger,
    });
    expect(connection?.device).toBe(device);
    expect(connection?.roomNames).toStrictEqual(
      new Map([
        ["50625967", "Cocina"],
        ["50638987", "Lavadero"],
      ])
    );
  });

  test("the session, home data and MQTT session are shared by the robots", async () => {
    const { service, deps } = setup();
    await service.connect({ duid: "duid-1", ip: "192.168.86.26" });
    await service.connect({ duid: "duid-1" });
    expect(deps.loadSession).toHaveBeenCalledTimes(1);
    expect(deps.getHomeData).toHaveBeenCalledTimes(1);
    expect(deps.createMqtt).toHaveBeenCalledTimes(1);
    expect(deps.connect).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ address: "192.168.86.26" })
    );
  });

  test("a robot that isn't in the account", async () => {
    const { service, deps } = setup();
    await expect(service.connect({ duid: "nope" })).rejects.toThrow(
      'Roborock: no robot "nope" in your account. Its robots: "Saros 20 Neo" (duid-1), "Q7" (duid-2)'
    );
    expect(deps.connect).not.toHaveBeenCalled();
  });

  test("a robot with an unsupported protocol", async () => {
    const { service } = setup();
    await expect(service.connect({ duid: "duid-2" })).rejects.toThrow(
      "uses protocol B01, which isn't supported yet"
    );
  });

  test("no saved session", async () => {
    const { service, log } = setup({ session: undefined });
    await expect(service.connect({ duid: "duid-1" })).rejects.toThrow(
      "the account isn't available"
    );
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Roborock: no saved session found. Log in with `npx node-miio roborock login`"
      )
    );
  });

  test("an expired session; the home data is requested again next time", async () => {
    const { service, log, deps } = setup({
      homeError: new RoborockSessionExpiredError(),
    });
    await expect(service.connect({ duid: "duid-1" })).rejects.toThrow();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("Roborock: the session expired.")
    );
    await expect(service.connect({ duid: "duid-1" })).rejects.toThrow();
    expect(deps.getHomeData).toHaveBeenCalledTimes(2);
  });
});

describe("RoborockService: other failures", () => {
  test("the session can't be loaded", async () => {
    const { service, log, deps } = setup();
    deps.loadSession.mockRejectedValue(new Error("EACCES"));
    await expect(service.connect({ duid: "duid-1" })).rejects.toThrow(
      "the account isn't available"
    );
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Roborock: failed to load the session: Error: EACCES."
      )
    );
  });

  test("a robot without a known model", async () => {
    const { service, deps } = setup();
    deps.getHomeData.mockResolvedValue({ ...home, products: [] });
    await expect(service.connect({ duid: "duid-1" })).rejects.toThrow(
      'Roborock: unknown model for "Saros 20 Neo"'
    );
  });

  test("other errors getting the robots", async () => {
    const { service, log } = setup({ homeError: new Error("offline") });
    await expect(service.connect({ duid: "duid-1" })).rejects.toThrow();
    expect(log.warn).toHaveBeenCalledWith(
      "Roborock: failed to get the robots of your account: Error: offline"
    );
  });
});

describe("RoborockService: default dependencies (node-miio)", () => {
  test("loads the session, the home data, and connects with node-miio", async () => {
    const nodeMiio = {
      loadRoborockSession: jest.fn().mockResolvedValue(session),
      RoborockWebApi: jest.fn().mockImplementation(() => ({
        getHomeData: jest.fn().mockResolvedValue(home),
      })),
      RoborockMqttSession: jest.fn(),
      roborockDevice: jest.fn().mockResolvedValue("device"),
      RoborockSessionExpiredError: class extends Error {},
      toDevices: jest.requireActual("node-miio").toDevices,
    };
    jest.resetModules();
    jest.doMock("node-miio", () => nodeMiio);
    const { RoborockService: Service } = await import("./roborock_service");
    const log = { debug: jest.fn(), info: jest.fn(), warn: jest.fn() };
    const connection = await new Service(log, { enabled: true }).connect({
      duid: "duid-1",
    });
    expect(connection?.device).toBe("device");
    expect(nodeMiio.loadRoborockSession).toHaveBeenCalledWith(undefined);
    expect(nodeMiio.RoborockWebApi).toHaveBeenCalledWith(session);
    expect(nodeMiio.RoborockMqttSession).toHaveBeenCalledWith(
      session.userData.rriot
    );
    expect(nodeMiio.roborockDevice).toHaveBeenCalledWith(
      expect.objectContaining({ duid: "duid-1", model: "roborock.vacuum.a296" })
    );
    jest.dontMock("node-miio");
  });
});
