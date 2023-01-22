// Global typedefs
// Anything defined in this file shouldn't need to be exported

/**
 * Corresponds to strings and anything that can be serialized by JSON.stringify.
 * The difference between this type and JSONResolvable is that JSONResolvable implies usage as JSON,
 * so strings would get stringified too, whereas this type is just for when a string is needed as the
 * end type, so strings wouldn't get stringified and would remain unmodified. Details are dependent on
 * actual usage, though
 */
type StringResolvable = JSONResolvable;

/**
 * Represents anything that would be a valid JSON construct
 */
type JSONResolvable =
  | string
  | number
  | boolean
  | object
  | Array<any>
  | null
  | {
      toJSON: (
        key?: string
      ) => Exclude<StringResolvable, { toJSON: (key?: string) => string }>;
    };

type Nullable<T> = T | null;
type Optional<T> = T | undefined;
type Maybe<T> = T | null | undefined;
/**
 * Useful when you want to be able to default assign an empty object
 * to avoid undefined prop access errors, but the properties are not
 * actually optional.
 *
 * @example ```ts
 * function myFunction({ value = {} }: { value: MyType | Empty<MyType> }) {
 *  // If default assignment was not used, |value| will be |MyType| as it was defined
 * }
 * ```
 */
type Empty<T extends object> = { [K in keyof T as K]?: undefined };

type BasicCallable = (...args: any) => any;

type Mutable<T> = T extends any[]
  ? T[number][]
  : T extends object
  ? { -readonly [P in keyof T]: Mutable<T[P]> }
  : T;

type AnyConstructor<C = any> =
  | (new (...args: any[]) => C)
  | (abstract new (...args: any[]) => C);

type GlobalThisType = typeof globalThis;

interface Keyed {
  key: string;
}

/**
 * Any value may be `await`ed, not just Promises; awaiting a non-Promise
 * is a no-op that immediately resolves back to the value
 */
type Awaitable<T> = T | Promise<T>;

/**
 * A type that makes the given properties K of T nullable. K defaults to all keys in T
 */
type NullableProps<T, K extends keyof T = keyof T> = { [P in K]: T[P] | null };

/**
 * A type that makes the given properties K of T non-nullable and non-optional. K defaults to all keys in T
 */
type NonNullableProps<T, K extends keyof T = keyof T> = {
  [P in K]-?: NonNullable<T[P]>;
};

type MaybeProps<T, K extends keyof T = keyof T> = { [P in K]: T[P] | null | undefined };

type OptionalProps<T, K extends keyof T = keyof T> = { [P in K]: T[P] | undefined };

type PartialProps<T, K extends keyof T = keyof T> = { [P in K]?: T[P] };

type WithNullableProps<T, K extends keyof T = keyof T> = Omit<T, K> & NullableProps<T, K>;
type WithNonNullableProps<T, K extends keyof T = keyof T> = Omit<T, K> &
  NonNullableProps<T, K>;
type WithMaybeProps<T, K extends keyof T = keyof T> = Omit<T, K> & MaybeProps<T, K>;
type WithPartialProps<T, K extends keyof T = keyof T> = Omit<T, K> & PartialProps<T, K>;
type WithOptionalProps<T, K extends keyof T = keyof T> = Omit<T, K> & OptionalProps<T, K>;
type WithPartialMaybeProps<T, K extends keyof T = keyof T> = Omit<T, K> &
  Partial<NullableProps<T, K>>;

type TypeProps<T, U, K extends keyof T = keyof T> = { [P in K]: U };
type WithTypeProps<T, U, K extends keyof any = keyof T> = Omit<T, Extract<keyof T, K>> &
  TypeProps<T, U, Extract<keyof T, K>>;

type ArrayOfNonNull<T extends Array<any>> = NonNullable<T[number]>[];

type Entries<T, K extends keyof T> = { [P in K]: [P, T[P]] }[K][];
