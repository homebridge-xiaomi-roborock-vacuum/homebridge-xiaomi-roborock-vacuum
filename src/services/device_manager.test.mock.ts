import { vi } from "vitest";
import { miio } from "../test.mocks.js";

vi.doMock("node-miio", () => miio.createMock());
