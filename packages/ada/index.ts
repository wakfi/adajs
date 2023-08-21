import { makeClient } from '@ada/lib/core/client/factory/client-loader';
import { resolveConfig } from '@ada/lib/core/resolve-config';
import { verbose } from '@ada/lib/utils/logging';
import type { AdaConfig } from '@ada/types';

export async function createClient(configArg?: AdaConfig) {
  verbose.log('createClient');
  const config = await resolveConfig(configArg);
  const client = await makeClient(config);
  verbose.log('finished createClient');
  return client;
}

export type { AdaConfig, CommandConfig } from '@ada/types';
