// Package-agnostic helpers

export function tryIgnore<T extends (...args: any[]) => any>(
  cb: T,
  ...args: Parameters<T>
): ReturnType<T> extends PromiseLike<infer U>
  ? U extends void
    ? ReturnType<T>
    : ReturnType<T> extends Promise<U>
    ? Promise<U | undefined>
    : PromiseLike<U | undefined>
  : ReturnType<T> | undefined {
  try {
    const val = cb(...args);
    if (val instanceof Promise) {
      return val.catch(() => undefined) as any;
    }
    return val;
  } catch {}
  // We should only reach here if the callback is synchronous and throws an error
  return undefined as any;
}

export const tryParse = <T = any>(s: string): T | undefined => {
  try {
    return JSON.parse(s);
  } catch {}
  return undefined;
};

/**
 * Sleeps for the specified number of milliseconds
 */
export function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
