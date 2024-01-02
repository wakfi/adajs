import {
  ApplicationCommandOption,
  ApplicationCommandType,
  ClientOptions,
  Collection,
  CommandInteraction,
  LocalizationMap,
  MessageContextMenuCommandInteraction,
  PermissionsString,
  Snowflake,
  UserContextMenuCommandInteraction,
} from 'discord.js';
import { collectionPathSym, inferredNameSym, namePathSym } from './utils/private-symbols';

export type DebugOptions = {
  showConfig: boolean;
  loader: boolean;
  commands: boolean;
  events: boolean;
  autoRegister: boolean;
  interactions: boolean;
  messages: boolean;
  permissions: boolean;
  ratelimits: boolean;
  shards: boolean;
  hotReload: boolean;
};

type BaseAdaConfig = {
  /**
   * Root directory of bot
   * @default '.'
   */
  rootDir?: string;

  /**
   * Commands directory
   *
   * Note: If this path is relative, it is _always_ relative to `rootDir`
   * @default `${rootDir}/commands`
   */
  commandsDir?: string;

  /**
   * Whether to watch the commands directory for changes and hot-reload them
   * @default false
   */
  watch?: boolean;

  /**
   * Whether command registration should be automatically performed using provided command information
   * @default false
   */
  autoRegisterCommands?: boolean;

  /**
   * Discord bot constructor options
   */
  bot?: ClientOptions;

  /**
   * Settings for debug logging. True enables all debug logging, false disables all debug logging
   * @default false
   */
  debug?: boolean | Partial<DebugOptions>;
};

export type AdaConfig = BaseAdaConfig &
  (
    | {
        autoRegisterCommands?: false;

        /**
         * If using command auto-registration the bot user ID is needed in order generate the API endpoint URL
         */
        clientId?: undefined;

        /**
         * If using command auto-registration the bot token is needed in order to send the API request, for authentication
         */
        token?: undefined;
      }
    | {
        autoRegisterCommands: true;

        /**
         * If using command auto-registration the bot user ID is needed in order generate the API endpoint URL
         */
        clientId: Snowflake;

        /**
         * If using command auto-registration the bot token is needed in order to send the API request, for authentication
         */
        token: string;
      }
  );

export type ResolvedAdaConfig = Required<AdaConfig> & {
  // `& object` gets rid of the `boolean` that would be included in the union for the property as a result of the intersection
  debug: DebugOptions & object;
};

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
// eslint-disable-next-line @typescript-eslint/no-empty-interface
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
export type CommandEntry = { handler: AnyCommandHandler } & ResolvedCommandConfig;
export type CommandsCollection = Collection<'.', CommandEntry> &
  Collection<string, CommandEntry | CommandsCollection> &
  Collection<typeof collectionPathSym, string[]>;

export type SlashCommandHandler = (interaction: CommandInteraction) => Awaitable<any>;
export type UserContextMenuHandler = (
  interaction: UserContextMenuCommandInteraction
) => Awaitable<any>;
export type MessageContextMenuHandler = (
  interaction: MessageContextMenuCommandInteraction
) => Awaitable<any>;
type AnyInteraction =
  | CommandInteraction
  | UserContextMenuCommandInteraction
  | MessageContextMenuCommandInteraction;
type AnyCommandHandler =
  | SlashCommandHandler
  | UserContextMenuHandler
  | MessageContextMenuHandler;

export type CommandHandler<T extends CommandConfig = Record<string, never>> = T extends {
  type: infer U;
}
  ? (interaction: AnyInteraction & { commandType: U }) => Awaitable<any>
  : SlashCommandHandler;
