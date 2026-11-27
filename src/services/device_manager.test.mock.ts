import { vi } from "vitest";
import { miio } from "../test.mocks";

vi.doMock("node-miio", () => miio.createMock());
