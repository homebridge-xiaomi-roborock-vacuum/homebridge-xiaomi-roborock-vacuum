/**
 * Converts a method/promise to the callback approach.
 * @param fn Method or Promise to run.
 * @param callback Callback to call with the result of `fn`.
 */
export async function callbackify<ReturnedValue>(
  fn: () => ReturnedValue | Promise<ReturnedValue>,
  callback: (err: Error | null, result?: ReturnedValue) => void
): Promise<void> {
  try {
    const result = await fn();
    callback(null, result);
  } catch (err) {
    callback(err as Error);
  }
}
