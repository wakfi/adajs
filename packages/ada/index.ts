import { getConfig } from '@config/utils/scanner';
import { createClient } from '@ada/lib/core/client/factory/client-loader';
import { AdaConfig } from '@config/types';

export const makeClient = async (configArg?: AdaConfig) => {
  const config = getConfig(configArg);
  const client = await createClient(config);
  return client;
};
//
