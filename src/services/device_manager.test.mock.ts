import { miio } from "../test.mocks";

jest.doMock("node-miio", () => miio.createMock());
