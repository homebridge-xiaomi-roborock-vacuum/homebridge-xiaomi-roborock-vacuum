/**
 * Calls the function `fn` if `maybeValue` is not undefined
 *
 * @param maybeValue The value that can be undefined
 * @param fn The function to be called with the value as a parameter
 */
export async function safeCall<ArgumentValue, ReturnedValue>(
  maybeValue: ArgumentValue | undefined,
  fn: (value: ArgumentValue) => void | Promise<void>
): Promise<void> {
  if (typeof maybeValue !== "undefined") {
    await fn(maybeValue);
  }
}
