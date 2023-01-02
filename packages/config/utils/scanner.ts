import { AdaConfig } from '../types';
import { importJson, mainFilepath } from './helpers';
import { createContext, runInContext } from 'vm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { tryIgnore } from 'shared/utils/helpers';

const configFiles = [
  'ada.config.js',
  'ada.config.cjs',
  'ada.config.mjs',
  '.adaconfig.json',
];

const vmContext = createContext(globalThis, {
  name: 'AdaConfig Loader',
  microtaskMode: 'afterEvaluate',
});

const tryJs = (filename: string): Optional<AdaConfig> => {
  const body = tryIgnore(readFileSync, filename, { encoding: 'utf8' }) as string;
  if (body === undefined) return;
  return runInContext(body, vmContext, { filename });
};

const tryJson = (filename: string) => importJson<AdaConfig>(filename);

const tryFilename = (filename: string): Optional<AdaConfig> => {
  if (filename.endsWith('json')) {
    return tryJson(filename);
  }
  return tryJs(filename);
};

const findConfig = (filenames: string[]) => {
  const rootDir = join(mainFilepath(), '..');
  for (const filename of filenames) {
    const filepath = join(rootDir, filename);
    const maybeConfig = tryFilename(filepath);
    if (maybeConfig) {
      return maybeConfig;
    }
  }
  // TODO: if(environment !== production)
  console.warn('No adaconfig found, using default config');
  return DEFAULT_CONFIG;
};

export const getConfig = (): Required<AdaConfig> => {
  const config = findConfig(configFiles);
  if (config === DEFAULT_CONFIG) {
    return config as typeof DEFAULT_CONFIG;
  }
  // Merge config against DEFAULT_CONFIG for exhaustiveness
  // and to perform default property assignments
  const fullConfig = Object.assign({}, DEFAULT_CONFIG, config);
  return fullConfig;
};

const DEFAULT_CONFIG: Required<AdaConfig> = {
  rootDir: '.',
  commandsDir: './commands',
  autoRegisterCommands: false,
};
