import { AdaConfig } from '@config/types';
import {
  ApplicationCommandType,
  ApplicationCommandOptionType,
  Collection,
  LocalizationMap,
  PermissionsString,
  ApplicationCommandOption,
  Snowflake,
} from 'discord.js';
import {
  collectionPathSym,
  inferredNameSym,
  namePathSym,
} from './lib/utils/private-symbols';

export type ResolvedAdaConfig = Required<AdaConfig>;

interface BaseCommandConfig {
  name?: string;
  description?: string;
  /**
   * Default type is slash-command (ApplicationCommandType.ChatInput)
   * If this command is a subcommand, it will be inferred from the file structure
   */
  type?: ApplicationCommandType;
  /**
   * Unimplemented. Currently, ALL COMMANDS ARE GLOBAL
   * TODO: Figure out how to deal with non-global commands in a sensible way
   */
  global?: boolean;
  disable?: boolean;
  localizations?: {
    name?: LocalizationMap;
    description?: LocalizationMap;
  };
  directMessage?: boolean;
  /**
   * Permissions required by this command. The permissions the bot needs in order to
   * do the things it wants to do in this command
   */
  clientPermissions?: PermissionsString[];
  /**
   * Permissions configuration for setting the permissions of the command. This is talking about
   * end-user permissions
   */
  defaultPermissions?: PermissionsString[];
  options?: ApplicationCommandOption[];
  /**
   * If undefined, access is unlimited. If defined, an array of user IDs is expected.
   * The command can only be invoked if the user's ID is in the array
   */
  limitAccess?: Snowflake[];
  /**
   * Marks whether this command is age restricted
   */
  nsfw?: boolean;
}

// This exists for declaration merging by library consumers
export interface CommandConfig extends BaseCommandConfig {}

type ResolvedCommandConfig = WithTypeProps<
  Required<BaseCommandConfig> &
    CommandConfig & {
      [namePathSym]: string[];
      [inferredNameSym]: string;
    },
  bigint,
  `${string}Permissions`
>;

// TODO: Maybe more specific typedef for the handler
export type CommandEntry = { handler: BasicCallable } & ResolvedCommandConfig;
export type CommandsCollection = Collection<string, CommandEntry | CommandsCollection> &
  Collection<typeof collectionPathSym, string[]>;
