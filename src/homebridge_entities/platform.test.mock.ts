import { BehaviorSubject } from "rxjs";
import { XiaomiRoborockVacuumPlatformAccessoryInitializer } from "./platform_accessory";

export const XiaomiRoborockVacuumPlatformAccessoryInitializerMock = jest
  .fn()
  .mockImplementation(() => {
    const initialized$ = new BehaviorSubject<void>(void 0);
    return { initialized$ } as jest.Mocked<
      Pick<
        XiaomiRoborockVacuumPlatformAccessoryInitializer,
        keyof XiaomiRoborockVacuumPlatformAccessoryInitializer
      >
    >;
  });

jest.doMock("./platform_accessory", () => ({
  XiaomiRoborockVacuumPlatformAccessoryInitializer:
    XiaomiRoborockVacuumPlatformAccessoryInitializerMock,
}));
