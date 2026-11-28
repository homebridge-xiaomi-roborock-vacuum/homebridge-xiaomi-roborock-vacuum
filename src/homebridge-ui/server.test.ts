import { describe, test, expect, vi, beforeAll } from "vitest";

const { servers, handlers, createHandlers } = vi.hoisted(() => {
  const handlers = {
    "/ok": vi.fn(async (payload: unknown) => ({ echo: payload })),
    "/fails": vi.fn(async () => {
      throw new Error("Boom");
    }),
  };
  return {
    servers: [] as unknown[],
    handlers,
    createHandlers: vi.fn(() => handlers),
  };
});

vi.mock("@homebridge/plugin-ui-utils", () => {
  class RequestError extends Error {
    constructor(
      message: string,
      readonly requestError: unknown
    ) {
      super(message);
    }
  }
  class HomebridgePluginUiServer {
    homebridgeConfigPath = "/homebridge/config.json";
    requests = new Map<string, (payload: unknown) => Promise<unknown>>();
    pushEvent = vi.fn();
    ready = vi.fn();
    constructor() {
      servers.push(this);
    }
    onRequest(path: string, fn: (payload: unknown) => Promise<unknown>) {
      this.requests.set(path, fn);
    }
  }
  return { HomebridgePluginUiServer, RequestError };
});

vi.mock("./handlers.js", () => ({ createHandlers }));

interface FakeServer {
  requests: Map<string, (payload: unknown) => Promise<unknown>>;
  pushEvent: ReturnType<typeof vi.fn>;
  ready: ReturnType<typeof vi.fn>;
}

describe("homebridge-ui/server", () => {
  let server: FakeServer;
  // Recorded at import time: the mocks' calls are cleared before each test
  let createHandlersArgs: unknown[];
  let readyCalls: number;

  beforeAll(async () => {
    await import("./server.js");
    expect(servers).toHaveLength(1);
    server = servers[0] as FakeServer;
    createHandlersArgs = createHandlers.mock.calls[0] as unknown[];
    readyCalls = server.ready.mock.calls.length;
  });

  test("creates the handlers with Homebridge's config path and signals ready", () => {
    expect(createHandlersArgs).toEqual([
      expect.any(Function),
      undefined,
      "/homebridge/config.json",
    ]);
    expect([...server.requests.keys()]).toEqual(["/ok", "/fails"]);
    expect(readyCalls).toBe(1);
  });

  test("forwards pushed events to the UI", () => {
    const push = createHandlersArgs[0] as (
      event: string,
      data: unknown
    ) => void;
    push("progress", { step: 1 });
    expect(server.pushEvent).toHaveBeenCalledWith("progress", { step: 1 });
  });

  test("answers requests with the handler's result", async () => {
    await expect(server.requests.get("/ok")!({ a: 1 })).resolves.toEqual({
      echo: { a: 1 },
    });
    expect(handlers["/ok"]).toHaveBeenCalledWith({ a: 1 });
  });

  test("turns a handler's error into a RequestError with its message", async () => {
    const { RequestError } = await import("@homebridge/plugin-ui-utils");
    const result = server.requests.get("/fails")!(undefined);
    await expect(result).rejects.toBeInstanceOf(RequestError);
    await expect(result).rejects.toThrow("Boom");
  });
});
