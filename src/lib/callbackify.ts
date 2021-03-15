export async function callbackify<ReturnedValue>(
  fn: () => ReturnedValue | Promise<ReturnedValue>,
  callback: (err: Error | null, result?: ReturnedValue) => void
): Promise<void> {
  try {
    const result = await fn();
    callback(null, result);
  } catch (err) {
    callback(err);
  }
}
