import type { VacuumDevice } from "node-miio";

/** The vacuum classes of node-miio that have the given method */
export type VacuumWith<Method extends string> = Extract<
  VacuumDevice,
  Record<Method, (...args: never[]) => unknown>
>;

/**
 * Whether the vacuum supports a method that only some node-miio classes have (e.g. the Roborock-only `cleanZones`).
 * It also narrows the type, so the method can be called afterwards.
 *
 * @param device The vacuum
 * @param method The method name
 * @returns `true` if the device has that method
 */
export function supports<Method extends string>(
  device: VacuumDevice,
  method: Method
): device is VacuumWith<Method> {
  return (
    typeof (device as unknown as Record<string, unknown>)[method] === "function"
  );
}
