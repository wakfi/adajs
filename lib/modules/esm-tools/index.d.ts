declare module 'lib/modules/esm-tools/helpers.mjs' {
  function deepcopy<T>(obj: T): T;
  function traverseObject(obj: unknown, callback: (value: any) => void): void;
  function deepEqual(a: unknown, b: unknown): boolean;
}
