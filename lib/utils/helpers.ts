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

/** Returns true if |v| is null or undefined ("nullish"), false otherwise */
// Intentionally uses abstract equality operator (==), not strict equality.
// null with `==` only returns true when comparing with either null or undefined,
// thus suiting our purposes
export const isNullish = (v: any): v is null | undefined => v == null;

export function isEmptyObj(obj: Maybe<any>): obj is Maybe<Record<keyof any, never>> {
  if (!obj) return true;
  return (
    Object.keys(obj).length === 0 &&
    // True if obj has null proto or has Object proto
    [Object.prototype, null].includes(Object.getPrototypeOf(obj))
  );
}

// @ts-expect-error String comparison + boolean-integer coercion to produce -1, 0, or 1
// for an ascending lexical sort by property key
export const strcmp = (a = '', b = ''): number => (a > b) - (a < b);

type WithoutNullish<T extends object> = {
  [K in keyof T as T[K] extends null | undefined ? never : K]?: NonNullable<T[K]>;
};

/** Removes nullish values from object. Returns a new object */
export const removeNullish = <T extends object>(obj: T): WithoutNullish<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, val]) => !isNullish(val))) as any;
