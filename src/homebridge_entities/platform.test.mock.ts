import { BehaviorSubject } from "rxjs";
import { XiaomiRoborockVacuumPlatformAccessoryInitializer } from "./platform_accessory";

export const XiaomiRoborockVacuumPlatformAccessoryInitializerMock = jest
  .fn()
  .mockImplementation(() => {
    // `true`: the HomeKit accessory has services
    const initialized$ = new BehaviorSubject<boolean>(true);
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
