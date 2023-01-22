import { AdaConfig } from '../types';
import { importJson, mainFilepath } from './helpers';
import { createContext, runInContext } from 'vm';
import { readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { tryIgnore } from 'shared/utils/helpers';

const configFiles = [
  'ada.config.js',
  'ada.config.cjs',
  'ada.config.mjs',
  '.adaconfig.json',
  '.adaconfig',
];

const vmContext = createContext(globalThis, {
  name: 'AdaConfig Loader',
});

const rootDir = resolve(mainFilepath(), '..');
console.log(mainFilepath());

const tryJs = (filename: string): Optional<AdaConfig> => {
  const body = tryIgnore(readFileSync, filename, { encoding: 'utf8' }) as string;
  console.log('file', filename, 'body is', body);
  if (body === undefined) return;
  return runInContext(`${body};exports`, vmContext, { filename });
};

const tryJson = (filename: string) => importJson<AdaConfig>(filename);

const tryFilename = (filename: string): Optional<AdaConfig> => {
  if (filename.endsWith('/adaconfig.json') || filename.endsWith('/.adaconfig')) {
    return tryJson(filename);
  }
  return tryJs(filename);
};

const findConfig = (filenames: string[]) => {
  let base = rootDir;
  const root = resolve(relative('.', '/'));
  // Keep trying until we reach root directory. Don't try to scan the root directory
  while (base !== root) {
    for (const filename of filenames) {
      const filepath = join(base, filename);
      const maybeConfig = tryFilename(filepath);
      if (maybeConfig) {
        console.log('FOUND adaconfig at', filepath);
        return maybeConfig;
      }
    }
    // Go up one level, try again
    base = resolve(base, '..');
  }
  // TODO: if(environment !== production)
  console.warn('No adaconfig found, using default config');
  return DEFAULT_CONFIG;
};

const resolveFullConfig = (config: AdaConfig): Required<AdaConfig> => {
  console.log('resolveFullConfig');
  // TODO: Handle default better
  // Merge config against DEFAULT_CONFIG for exhaustiveness
  // and to perform default property assignments
  const mergedConfig = Object.assign({}, DEFAULT_CONFIG, config);
  // Ensure absolute rootDir path
  mergedConfig.rootDir = resolve(rootDir, mergedConfig.rootDir);
  // Ensure absolute commandsDir path
  mergedConfig.commandsDir = resolve(mergedConfig.rootDir, mergedConfig.commandsDir);
  // Ensure autoRegisterCommands, token, clientId keys
  mergedConfig.autoRegisterCommands = !!mergedConfig.autoRegisterCommands;
  if (!mergedConfig.autoRegisterCommands) {
    // @ts-expect-error
    mergedConfig.token = undefined;
    // @ts-expect-error
    mergedConfig.clientId = undefined;
  }
  if (!config.bot) {
    // discord.js will fill out |config.bot| automatically for us during client construction.
    // We have access to the result
    config.bot = { intents: [] };
  }
  return mergedConfig;
};

export const getConfig = (configArg: Optional<AdaConfig>): Required<AdaConfig> => {
  console.log('getConfig');
  const config = configArg || findConfig(configFiles);
  const fullConfig = resolveFullConfig(config);
  return fullConfig;
};

const DEFAULT_CONFIG: Required<AdaConfig> = {
  rootDir: '.',
  commandsDir: './commands',
  autoRegisterCommands: false,
  bot: {
    allowedMentions: {
      parse: [],
      repliedUser: true,
    },
    intents: [],
  },
  // @ts-expect-error Shrug
  clientId: undefined,
  // @ts-expect-error Shrug
  token: undefined,
};
