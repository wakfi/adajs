import { cosmiconfigSync } from 'cosmiconfig';
import { transformSync } from 'esbuild';
import type { CommandConfig } from 'src/types';
import { runInNewContext } from 'vm';
import { inferredNameSym, namePathSym } from './private-symbols';

// These aren't in src/types because it won't be external
type UnresolvedCommandConfig = CommandConfig & {
  [namePathSym]: string[];
  [inferredNameSym]: string;
};

interface ExecuteFileParams {
  body: string;
  filepath: string;
}

export type HandlerFileExports = {
  config?: UnresolvedCommandConfig;
  default?: BasicCallable;
  handler?: BasicCallable;
};

export const executeFile = ({ body, filepath }: ExecuteFileParams) => {
  if (filepath.endsWith('.ts')) {
    return executeTsFile({ body, filepath });
  }
  return executeJsFile({ body, filepath });
};

export const executeTsFile = ({ body, filepath }: ExecuteFileParams) => {
  const explorer = cosmiconfigSync('tsconfig', {
    searchPlaces: ['tsconfig.json'],
  });
  const result = explorer.search(filepath);
  const tsconfigRaw = result?.config;
  const transformed = transformSync(body, {
    tsconfigRaw,
    sourcefile: filepath,
    target: 'esnext',
    platform: 'node',
    format: 'cjs',
    loader: 'ts',
  });
  return executeJsFile({ body: transformed.code, filepath });
};

export const executeJsFile = ({ body, filepath }: ExecuteFileParams) =>
  runInNewContext(
    `${body};\nlet namespaced=false;for(let k in module.exports){if(Object.prototype.hasOwnProperty.call(module.exports,k)){/*console.log('(VM) K is',k);*/namespaced=true;break}};namespaced?module.exports:exports;`,
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
      require,
    },
    {
      filename: filepath,
      breakOnSigint: true,
    }
  );
