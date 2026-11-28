import { vi, type Mocked } from "vitest";
import { BehaviorSubject } from "rxjs";
import { XiaomiRoborockVacuumPlatformAccessoryInitializer } from "./platform_accessory.js";

export const XiaomiRoborockVacuumPlatformAccessoryInitializerMock = vi
  .fn()
  // A `function`: the plugin calls it with `new`
  .mockImplementation(function () {
    // `true`: the HomeKit accessory has services
    const initialized$ = new BehaviorSubject<boolean>(true);
    return { initialized$ } as Mocked<
      Pick<
        XiaomiRoborockVacuumPlatformAccessoryInitializer,
        keyof XiaomiRoborockVacuumPlatformAccessoryInitializer
      >
    >;
  });

vi.doMock("./platform_accessory.js", () => ({
  XiaomiRoborockVacuumPlatformAccessoryInitializer:
    XiaomiRoborockVacuumPlatformAccessoryInitializerMock,
}));
