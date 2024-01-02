import { makeClient } from 'src/core/client/factory/client-loader';
import { resolveConfig } from 'src/core/resolve-config';
import type { AdaConfig } from 'src/types';
import { verbose } from 'src/utils/logging';

export async function createClient(configArg?: AdaConfig) {
  verbose.log('createClient');
  const config = await resolveConfig(configArg);
  const client = await makeClient(config);
  verbose.log('finished createClient');
  return client;
}

export type {
  AdaConfig,
  CommandConfig,
  CommandHandler,
  CommandsCollection,
} from 'src/types';
export type { AdaClient } from 'src/core/client/AdaClient';
export type { InteractionOfCommand } from 'src/core/client/factory/client-loader';
