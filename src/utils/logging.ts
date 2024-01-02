const __defineProperty: <T extends object, K extends PropertyKey, V>(
  o: T,
  p: K,
  attributes: {
    value?: V;
    get?(): V;
    set?(value: V): void;
    enumerable?: boolean;
    configurable?: boolean;
    writable?: boolean;
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
) => T & { [P in K]: V } = Object.defineProperty as any;

interface CreateLoggerOptions {
  label?: string;
  console?: Console;
}

/**
 * Create a logger controlled by a predicate function. This is useful for writing
 * log statements that are gated in same way
 */
export function createLogger(
  predicate: () => boolean,
  options?: CreateLoggerOptions
): Console;
/**
 * Create a logger controlled by a boolean value. This is useful for writing
 * log statements that are gated in some way
 */
export function createLogger(
  control: { enabled: boolean },
  options?: CreateLoggerOptions
): Console;
export function createLogger(
  control: (() => boolean) | { enabled: boolean },
  options?: CreateLoggerOptions
) {
  return typeof control === 'function'
    ? createLoggerWithPredicate(control, options)
    : createLoggerWithDataProp(control, options);
}

function createLoggerWithPredicate(
  predicate: () => boolean,
  options?: CreateLoggerOptions
) {
  const control = __defineProperty({}, 'enabled', {
    get: predicate,
    enumerable: true,
    configurable: true,
  });
  return createLoggerWithDataProp(control, options);
}

/**
 * Create a logger that is controlled by a boolean value. This is useful for writing
 * log statements that are gated by some means
 */
function createLoggerWithDataProp(
  control: { enabled: boolean },
  { label, console = globalThis.console }: CreateLoggerOptions = {}
) {
  const logger = new Proxy(console, {
    get: (...args) => {
      const [target, key] = args;
      const value = target[key as keyof typeof target];
      if (typeof value === 'function') {
        if (!control.enabled) {
          return () => {};
        }
        // console functions require console as their |this| context
        return Function.prototype.bind.apply(value, [
          target,
          ...(label ? [`[${label}]:`] : []),
        ]);
      }
      return value;
    },
  });
  return logger;
}

export const DEBUG_VERBOSE =
  process.env.ADA_DEBUG === 'true' || process.env.ADA_DEBUG === '1';
/** Special logger instance for ADA_DEBUG environment variable */
export const verbose = createLogger(() => DEBUG_VERBOSE, { label: 'verbose' });
