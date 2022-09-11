/**
 * Calls the function `fn` if `maybeValue` is not undefined
 *
 * @param maybeValue The value that can be undefined
 * @param fn The function to be called with the value as a parameter
 */
export function safeCall<ArgumentValue, ReturnedValue>(
  maybeValue: ArgumentValue | undefined,
  fn: (value: ArgumentValue) => unknown
): void {
  if (typeof maybeValue !== "undefined") {
    fn(maybeValue);
  }
}
