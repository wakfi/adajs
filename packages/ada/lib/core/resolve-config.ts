import { AdaConfig, DebugOptions, ResolvedAdaConfig } from '@ada/types';
import { PublicExplorer, cosmiconfig, Options } from 'cosmiconfig';
import { resolve, dirname } from 'path';
import { isEmptyObj, removeNullish } from 'shared/utils/helpers';
import { failedToLoadConfig } from '../errors/utils';
import { MODULE_NAME } from '../utils/constants';
import { TypeScriptLoader } from 'cosmiconfig-typescript-loader';

// Can't configure logging for this file using the config since the logs for
// this file happen while we're finding and normalizing the config. So we use
// an environment variable instead
const DEBUG_CONFIG =
  process.env.ADA_DEBUG_CONFIG === 'true' || process.env.ADA_DEBUG_CONFIG === '1';

const log = DEBUG_CONFIG ? console.log.bind(console) : () => {};

const DEFAULT_CONFIG: ResolvedAdaConfig = {
  rootDir: '.',
  commandsDir: './commands',
  watch: false,
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
  debug: {
    showConfig: false,
    loader: false,
    commands: false,
    events: false,
    autoRegister: false,
    interactions: false,
    messages: false,
    permissions: false,
    ratelimits: false,
    shards: false,
    hotReload: false,
  },
};

const normalizeDebugOptions = (debug: AdaConfig['debug']): DebugOptions => {
  log('normalizeDebugOptions');
  if (!debug) {
    return DEFAULT_CONFIG.debug;
  }
  if (debug === true) {
    return {
      showConfig: true,
      loader: true,
      commands: true,
      events: true,
      autoRegister: true,
      interactions: true,
      messages: true,
      permissions: true,
      ratelimits: true,
      shards: true,
      hotReload: true,
    };
  }
  const withoutNulls = removeNullish(debug);
  return Object.assign({}, DEFAULT_CONFIG.debug, withoutNulls);
};

type ConfigLoadResult = NonNullable<Awaited<ReturnType<PublicExplorer['search']>>> &
  (
    | {
        config: AdaConfig;
        isEmpty?: false;
      }
    | {
        config: Record<string, never>;
        isEmpty: true;
      }
  );

export const searchPlaces = [
  'package.json',
  `.${MODULE_NAME}rc`,
  `.${MODULE_NAME}rc.json`,
  `.${MODULE_NAME}rc.yaml`,
  `.${MODULE_NAME}rc.yml`,
  `.${MODULE_NAME}rc.js`,
  `.${MODULE_NAME}rc.mjs`,
  `.${MODULE_NAME}rc.cjs`,
  `.${MODULE_NAME}rc.ts`,
  `.config/${MODULE_NAME}rc`,
  `.config/${MODULE_NAME}rc.json`,
  `.config/${MODULE_NAME}rc.yaml`,
  `.config/${MODULE_NAME}rc.yml`,
  `.config/${MODULE_NAME}rc.js`,
  `.config/${MODULE_NAME}rc.cjs`,
  `.config/${MODULE_NAME}rc.mjs`,
  `.config/${MODULE_NAME}rc.ts`,
  `${MODULE_NAME}.config.ts`,
  `${MODULE_NAME}.config.js`,
  `${MODULE_NAME}.config.mjs`,
  `${MODULE_NAME}.config.cjs`,
];

const getCosmicOptions = (): Options => ({
  searchPlaces,
  loaders: {
    '.ts': TypeScriptLoader(),
  },
});

async function loadConfig(configArg?: AdaConfig): Promise<ConfigLoadResult> {
  log('loadConfig');
  if (!isEmptyObj(configArg)) {
    log('finished loadConfig');
    return { config: configArg, filepath: '', isEmpty: false };
  }
  const explorer = cosmiconfig(MODULE_NAME, getCosmicOptions());
  const result = await explorer.search();
  log('finished loadConfig');
  return result || { config: {}, filepath: '', isEmpty: true };
}

function normalizeConfig(config: AdaConfig, filepath: string): ResolvedAdaConfig {
  log('normalizeConfig');
  const withoutNulls = removeNullish(config);
  const normalized: ResolvedAdaConfig = Object.assign({}, DEFAULT_CONFIG, withoutNulls);
  const configDir = dirname(filepath);
  normalized.rootDir = resolve(configDir, normalized.rootDir);
  normalized.commandsDir = resolve(normalized.rootDir, normalized.commandsDir);
  normalized.debug = normalizeDebugOptions(normalized.debug);
  log('finished normalizeConfig', normalized);
  return normalized;
}

export async function resolveConfig(configArg?: AdaConfig): Promise<ResolvedAdaConfig> {
  log('resolveConfig');
  const loaded = await loadConfig(configArg);
  const { config, filepath, isEmpty } = loaded;
  if (isEmpty) {
    failedToLoadConfig();
  }
  const normalized = normalizeConfig(config, filepath);
  log('finished resolveConfig');
  if (normalized.debug.showConfig) {
    console.log(normalized);
  }
  return normalized;
}
