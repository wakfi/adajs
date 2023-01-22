import { runInNewContext } from 'vm';
import { namePathSym, inferredNameSym } from './private-symbols';
import type { CommandConfig } from '@ada/types';

// These aren't in @ada/types because it won't be external
type UnresolvedCommandConfig = CommandConfig & {
  [namePathSym]: string[];
  [inferredNameSym]: string;
};

export type HandlerFileExports = {
  config?: UnresolvedCommandConfig;
  default?: BasicCallable;
  handler?: BasicCallable;
};

export const executeFile = ({ body, filepath }) =>
  runInNewContext(
    `${body};\nlet namespaced=false;for(let k in module.exports){if(Object.prototype.hasOwnProperty.call(module.exports,k)){console.log('hi, K is',k);namespaced=true;break}};namespaced?module.exports:exports;`,
    {
      module: { exports: { __proto__: null } },
      exports: {},
      console: globalThis.console,
      atob: globalThis.atob,
      btoa: globalThis.btoa,
      setInterval: globalThis.setInterval,
      setTimeout: globalThis.setTimeout,
      clearInterval: globalThis.clearInterval,
      clearTimeout: globalThis.clearTimeout,
      structuredClone: globalThis.structuredClone,
      fetch: globalThis.fetch,
    },
    {
      filename: filepath,
      breakOnSigint: true,
    }
  );
