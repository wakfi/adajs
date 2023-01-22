import { getConfig } from '@config/utils/scanner';
import { makeClient } from '@ada/lib/core/client/factory/client-loader';
import { AdaConfig } from '@config/types';

export const createClient = async (configArg?: AdaConfig) => {
  console.log('createClient');
  const config = getConfig(configArg);
  console.log('finished getConfig');
  const client = await makeClient(config);
  console.log('finished createClient');
  return client;
};
