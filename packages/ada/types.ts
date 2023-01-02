import { AdaConfig } from '@config/types';

export type ResolvedAdaConfig = Required<AdaConfig>;

// TODO: Maybe more specific typedef for the handle (first element),
//       definitely more specific typedef for handler metadata config (second element)
export type DiscoveredCommand = [BasicCallable, Record<string, any>];
