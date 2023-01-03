import { AdaConfig } from '@config/types';
import { Collection } from 'discord.js';
import {
  collectionPathSym,
  inferredNameSym,
  namePathSym,
} from './lib/utils/private-symbols';

export type ResolvedAdaConfig = Required<AdaConfig>;

// TODO: Maybe more specific typedef for the handle (first element),
//       definitely more specific typedef for handler metadata config (second element)
export type DiscoveredCommand = [BasicCallable, ResolvedCommandConfig];

interface BaseCommandConfig extends Record<string, any> {
  name?: string;
  global?: boolean;
}

export interface CommandConfig extends BaseCommandConfig {}

export type ResolvedCommandConfig = Required<BaseCommandConfig> &
  CommandConfig & {
    [namePathSym]: string[];
    [inferredNameSym]: string;
  };
export type CommandEntry = ResolvedCommandConfig & { handler: DiscoveredCommand[0] };
export type CommandsCollection = Collection<string, CommandEntry | CommandsCollection> &
  Collection<typeof collectionPathSym, string[]>;
