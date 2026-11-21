import { createHandlers, type HandlerDeps } from "./handlers";

const session = { userId: "1", ssecurity: "s", serviceToken: "t" };
const flush = () => new Promise(setImmediate);

function setup(options: { session?: typeof session } = { session }) {
  const push = jest.fn();
  const cloud = {
    session,
    getDevices: jest.fn().mockResolvedValue([
      {
        did: "1",
        name: "Robot",
        model: "roborock.vacuum.s5",
        token: "ABC",
        localip: "10.0.0.2",
        server: "de",
        isOnline: true,
      },
      { did: "2", name: "Lamp", model: "yeelink.light.x", token: "zzz" },
    ]),
    getMapFileUrl: jest.fn(),
    download: jest.fn(),
  };
  const device = {
    getCloudMap: jest.fn().mockResolvedValue({
      image: {
        top: 10,
        left: 20,
        width: 2,
        height: 1,
        pixels: new Uint8Array([(16 << 3) | 7, 1]),
      },
      rooms: [{ id: 16 }, { id: 17 }],
      robot: { x: 1000, y: 600 },
      charger: { x: 1050, y: 600 },
    }),
    getRoomMap: jest.fn().mockResolvedValue([
      ["16", "Kitchen"],
      ["17", "12345678"], // Not a name (some models)
    ]),
    destroy: jest.fn(),
  };
  const deps = {
    loadSession: jest.fn().mockResolvedValue(options.session),
    saveSession: jest.fn(),
    deleteSession: jest.fn(),
    createCloud: jest.fn(() => cloud),
    loginWithQrCode: jest.fn(),
    connect: jest.fn().mockResolvedValue(device),
  };
  const handlers = createHandlers(push, deps as unknown as HandlerDeps);
  return { push, cloud, device, deps, handlers };
}

describe("custom UI handlers", () => {
  test("/cloud/status", async () => {
    await expect(
      setup().handlers["/cloud/status"]({ sessionFile: "/s.json" })
    ).resolves.toStrictEqual({ loggedIn: true, userId: "1" });
    await expect(
      setup({}).handlers["/cloud/status"]({})
    ).resolves.toStrictEqual({ loggedIn: false, userId: undefined });
  });

  test("/cloud/login-qr returns the QR code, and pushes the result once scanned", async () => {
    const { handlers, deps, push, cloud } = setup();
    let finish: (value: unknown) => void = () => {};
    deps.loginWithQrCode.mockImplementation(
      (onQrCode: (qr: unknown) => void) => {
        onQrCode({ imageUrl: "img", loginUrl: "url", timeoutMs: 1 });
        return new Promise((resolve) => (finish = resolve));
      }
    );
    await expect(
      handlers["/cloud/login-qr"]({ sessionFile: "/s.json" })
    ).resolves.toMatchObject({ imageUrl: "img", loginUrl: "url" });
    expect(push).not.toHaveBeenCalled();
    finish(cloud);
    await flush();
    expect(deps.saveSession).toHaveBeenCalledWith(session, "/s.json");
    expect(push).toHaveBeenCalledWith("cloud-login", { ok: true });
  });

  test("/cloud/login-qr failures: before the QR code (rejects) and after it (pushed)", async () => {
    const before = setup();
    before.deps.loginWithQrCode.mockRejectedValue(new Error("offline"));
    await expect(before.handlers["/cloud/login-qr"]({})).rejects.toThrow(
      "offline"
    );

    const after = setup();
    after.deps.loginWithQrCode.mockImplementation(
      async (onQrCode: (qr: unknown) => void) => {
        onQrCode({ imageUrl: "img", loginUrl: "url", timeoutMs: 1 });
        throw new Error("The QR code expired");
      }
    );
    await after.handlers["/cloud/login-qr"]({});
    await flush();
    expect(after.push).toHaveBeenCalledWith("cloud-login", {
      ok: false,
      error: "The QR code expired",
    });
  });

  test("/cloud/logout", async () => {
    const { handlers, deps } = setup();
    await handlers["/cloud/logout"]({ sessionFile: "/s.json" });
    expect(deps.deleteSession).toHaveBeenCalledWith("/s.json");
  });

  test("/cloud/devices lists the vacuums only, with their tokens", async () => {
    const { handlers, cloud } = setup();
    await expect(
      handlers["/cloud/devices"]({ server: "de" })
    ).resolves.toStrictEqual([
      {
        did: "1",
        name: "Robot",
        model: "roborock.vacuum.s5",
        token: "ABC",
        ip: "10.0.0.2",
        server: "de",
        isOnline: true,
      },
    ]);
    expect(cloud.getDevices).toHaveBeenCalledWith({ servers: ["de"] });
    await expect(setup({}).handlers["/cloud/devices"]({})).rejects.toThrow(
      "Log in to the Xiaomi Cloud first."
    );
  });

  test("/map: the map, with the room names, from the robot's server", async () => {
    const { handlers, device, deps, cloud } = setup();
    const map = await handlers["/map"]({ ip: "10.0.0.9", token: "abc" });
    expect(deps.connect).toHaveBeenCalledWith("10.0.0.9", "abc");
    expect(device.getCloudMap).toHaveBeenCalledWith(cloud, "de"); // Found by token
    expect(map).toStrictEqual({
      image: { top: 10, left: 20, width: 2, height: 1, pixels: "hwE=" },
      rooms: [
        { id: 16, name: "Kitchen" },
        { id: 17, name: undefined },
      ],
      robot: { x: 1000, y: 600 },
      charger: { x: 1050, y: 600 },
    });
    expect(device.destroy).toHaveBeenCalled();

    // The device list is reused
    await handlers["/map"]({ ip: "10.0.0.2", token: "other" });
    expect(cloud.getDevices).toHaveBeenCalledTimes(1);
  });

  test("/map: a vacuum configured by its device ID is found in the account", async () => {
    const { handlers, deps, device, cloud } = setup();
    await handlers["/map"]({ did: "1", ip: "10.0.0.99", token: "old" });
    // The account knows where it is now
    expect(deps.connect).toHaveBeenCalledWith("10.0.0.2", "ABC");
    expect(device.getCloudMap).toHaveBeenCalledWith(cloud, "de");
  });

  test("/map errors", async () => {
    const { handlers, device } = setup();
    await expect(handlers["/map"]({ ip: "", token: "" })).rejects.toThrow(
      "needs a device ID, or an IP and a token"
    );
    await expect(handlers["/map"]({ did: "999" })).rejects.toThrow(
      "check its device ID"
    );
    await expect(
      handlers["/map"]({ ip: "10.9.9.9", token: "nope" })
    ).rejects.toThrow("not in your Xiaomi account");

    const notRoborock = setup();
    notRoborock.deps.connect.mockResolvedValue({ destroy: jest.fn() });
    await expect(
      notRoborock.handlers["/map"]({ ip: "10.0.0.2", token: "abc" })
    ).rejects.toThrow("Only Roborock vacuums");

    device.getCloudMap.mockRejectedValue(new Error("map failed"));
    await expect(
      handlers["/map"]({ ip: "10.0.0.2", token: "abc", server: "de" })
    ).rejects.toThrow("map failed");
    expect(device.destroy).toHaveBeenCalled();
  });
});

describe("Roborock app account", () => {
  const roborockSession = {
    email: "me@example.com",
    baseUrl: "https://euiot.roborock.com",
    clientId: "c",
    userData: {
      token: "t",
      rriot: { u: "u", s: "s", h: "h", k: "k", r: { r: "EU", a: "a", m: "m" } },
    },
  };

  function setupRoborock(saved?: typeof roborockSession) {
    const login = {
      requestCode: jest.fn().mockResolvedValue(undefined),
      loginWithCode: jest.fn().mockResolvedValue(roborockSession),
    };
    const deps = {
      loadRoborockSession: jest.fn().mockResolvedValue(saved),
      saveRoborockSession: jest.fn(),
      deleteRoborockSession: jest.fn(),
      startRoborockLogin: jest.fn().mockResolvedValue(login),
      getRoborockDevices: jest.fn().mockResolvedValue([
        {
          duid: "duid-1",
          name: "Saros 20 Neo",
          model: "roborock.vacuum.a296",
          productName: "Qrevo Edge 3 Pro",
          protocolVersion: "1.0",
          firmwareVersion: "02.32.54",
          online: true,
          localKey: "secret",
          shared: false,
        },
        {
          duid: "duid-2",
          name: "Q7",
          model: "roborock.vacuum.sc05",
          protocolVersion: "B01",
          localKey: "secret2",
          shared: true,
        },
      ]),
    };
    const handlers = createHandlers(jest.fn(), deps as unknown as HandlerDeps);
    return { handlers, deps, login };
  }

  test("status", async () => {
    await expect(
      setupRoborock().handlers["/roborock/status"]({})
    ).resolves.toStrictEqual({ loggedIn: false, email: undefined });
    await expect(
      setupRoborock(roborockSession).handlers["/roborock/status"]({
        sessionFile: "/rr.json",
      })
    ).resolves.toStrictEqual({ loggedIn: true, email: "me@example.com" });
  });

  test("requests a code, then logs in with it (same login) and saves the session", async () => {
    const { handlers, deps, login } = setupRoborock();
    await expect(
      handlers["/roborock/request-code"]({ email: " Me@Example.com " })
    ).resolves.toStrictEqual({ sent: true });
    expect(deps.startRoborockLogin).toHaveBeenCalledWith("Me@Example.com");
    expect(login.requestCode).toHaveBeenCalled();

    await expect(
      handlers["/roborock/login"]({
        email: "me@example.com",
        code: " 123456 ",
        sessionFile: "/rr.json",
      })
    ).resolves.toStrictEqual({ loggedIn: true, email: "me@example.com" });
    expect(login.loginWithCode).toHaveBeenCalledWith("123456");
    expect(deps.saveRoborockSession).toHaveBeenCalledWith(
      roborockSession,
      "/rr.json"
    );
    // The login is done: a second one needs a new code
    await expect(
      handlers["/roborock/login"]({ email: "me@example.com", code: "1" })
    ).rejects.toThrow("Ask for a code first.");
  });

  test("missing email or code", async () => {
    const { handlers } = setupRoborock();
    await expect(handlers["/roborock/request-code"]({})).rejects.toThrow(
      "Enter the email of your Roborock account."
    );
    await handlers["/roborock/request-code"]({ email: "me@example.com" });
    await expect(
      handlers["/roborock/login"]({ email: "me@example.com", code: " " })
    ).rejects.toThrow("Enter the code from the email.");
  });

  test("lists the robots, without their local keys", async () => {
    const { handlers } = setupRoborock(roborockSession);
    const devices = await handlers["/roborock/devices"]({});
    expect(devices).toStrictEqual([
      {
        duid: "duid-1",
        name: "Saros 20 Neo",
        model: "roborock.vacuum.a296",
        productName: "Qrevo Edge 3 Pro",
        protocolVersion: "1.0",
        online: true,
        shared: false,
        supported: true,
      },
      {
        duid: "duid-2",
        name: "Q7",
        model: "roborock.vacuum.sc05",
        productName: undefined,
        protocolVersion: "B01",
        online: undefined,
        shared: true,
        supported: false,
      },
    ]);
    expect(JSON.stringify(devices)).not.toContain("secret");
  });

  test("not logged in, and logout", async () => {
    const { handlers, deps } = setupRoborock();
    await expect(handlers["/roborock/devices"]({})).rejects.toThrow(
      "Log in to your Roborock account first."
    );
    await expect(
      handlers["/roborock/logout"]({ sessionFile: "/rr.json" })
    ).resolves.toStrictEqual({ loggedIn: false });
    expect(deps.deleteRoborockSession).toHaveBeenCalledWith("/rr.json");
  });
});
