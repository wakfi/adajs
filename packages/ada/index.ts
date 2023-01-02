import { getConfig } from '@config/utils/scanner';
import { createClient } from '@ada/lib/core/client/factory/client-loader';
import { AdaConfig } from '@config/types';

export const makeClient = async (configArg?: AdaConfig) => {
  console.log('makeClient');
  const config = getConfig(configArg);
  console.log('finished getConfig');
  const client = await createClient(config);
  console.log('finished makeClient');
  return client;
};
//
