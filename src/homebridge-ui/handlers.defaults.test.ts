/**
 * The handlers with their default dependencies (node-miio, mocked here): the other tests replace them.
 */
const session = {
  email: "me@example.com",
  baseUrl: "https://euiot.roborock.com",
  clientId: "c",
  userData: {
    token: "t",
    rriot: { u: "u", s: "s", h: "h", k: "k", r: { r: "EU", a: "a", m: "m" } },
  },
};
const home = {
  id: 1,
  name: "Home",
  products: [{ id: "p1", name: "Saros 20", model: "roborock.vacuum.a296" }],
  devices: [
    {
      duid: "duid-1",
      name: "Saros 20 Neo",
      localKey: "key",
      productId: "p1",
      pv: "1.0",
    },
  ],
  receivedDevices: [],
  rooms: [{ id: 50638987, name: "Lavadero" }],
};
const map = {
  image: { top: 0, left: 0, width: 1, height: 1, pixels: new Uint8Array([0]) },
  rooms: [{ id: 10 }, { id: 11 }],
};

const login = {
  requestCode: jest.fn(async () => undefined),
  loginWithCode: jest.fn(async () => session),
};
const api = {
  getMap: jest.fn(async () => map),
  call: jest.fn(async () => [
    [10, "50638987"],
    [11, "unknown"],
  ]),
  close: jest.fn(),
};
const mqtt = { close: jest.fn(async () => undefined) };
const nodeMiio = {
  ...jest.requireActual<Record<string, unknown>>("node-miio"),
  loadRoborockSession: jest.fn(async () => session),
  saveRoborockSession: jest.fn(async () => undefined),
  deleteRoborockSession: jest.fn(async () => undefined),
  RoborockLogin: { start: jest.fn(async () => login) },
  RoborockWebApi: jest.fn(() => ({
    getHomeData: jest.fn(async () => home),
    getDevices: jest.fn(async () => [
      { duid: "duid-1", name: "Saros 20 Neo", protocolVersion: "1.0" },
    ]),
  })),
  RoborockMqttSession: jest.fn(() => mqtt),
  RoborockDeviceApi: jest.fn(() => api),
};
jest.doMock("node-miio", () => nodeMiio);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createHandlers } = require("./handlers") as typeof import("./handlers");

describe("handlers with their default dependencies", () => {
  const handlers = createHandlers(jest.fn());

  test("the Roborock login, devices and logout go through node-miio", async () => {
    await handlers["/roborock/request-code"]({ email: "me@example.com" });
    expect(nodeMiio.RoborockLogin.start).toHaveBeenCalledWith("me@example.com");
    await handlers["/roborock/login"]({ email: "me@example.com", code: "1" });
    expect(nodeMiio.saveRoborockSession).toHaveBeenCalledWith(
      session,
      undefined
    );
    await expect(handlers["/roborock/status"]({})).resolves.toStrictEqual({
      loggedIn: true,
      email: "me@example.com",
    });
    await expect(handlers["/roborock/devices"]({})).resolves.toMatchObject([
      { duid: "duid-1", supported: true },
    ]);
    await handlers["/roborock/logout"]({});
    expect(nodeMiio.deleteRoborockSession).toHaveBeenCalled();
  });

  test("the map of a Roborock-app vacuum: over MQTT, with its rooms named from the account", async () => {
    const response = await handlers["/map"]({
      duid: "duid-1",
      ip: "192.168.86.26",
    });
    expect(nodeMiio.RoborockDeviceApi).toHaveBeenCalledWith(
      expect.objectContaining({
        duid: "duid-1",
        localKey: "key",
        model: "roborock.vacuum.a296",
        address: "192.168.86.26",
        mqtt,
      })
    );
    expect(response.rooms).toStrictEqual([
      { id: 10, name: "Lavadero" },
      { id: 11, name: undefined },
    ]);
    // The connections are closed
    expect(api.close).toHaveBeenCalled();
    expect(mqtt.close).toHaveBeenCalled();
  });

  test("without the room mapping, the map still shows (rooms unnamed)", async () => {
    api.call.mockRejectedValueOnce(new Error("timeout"));
    const response = await handlers["/map"]({ duid: "duid-1" });
    expect(response.rooms).toStrictEqual([
      { id: 10, name: undefined },
      { id: 11, name: undefined },
    ]);
  });

  test("a vacuum that isn't in the Roborock account", async () => {
    await expect(handlers["/map"]({ duid: "nope" })).rejects.toThrow(
      "This vacuum is not in your Roborock account."
    );
  });
});
