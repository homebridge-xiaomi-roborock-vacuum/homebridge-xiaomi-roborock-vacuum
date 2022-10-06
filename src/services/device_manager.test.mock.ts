import { miio } from "../test.mocks";

jest.doMock("../miio", () => miio.createMock());
