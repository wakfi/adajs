import type { ClientOptions, Snowflake } from 'discord.js';

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
   * Whether command registration should be automatically performed using provided command information
   * @default false
   */
  autoRegisterCommands?: boolean;

  /**
   * Discord bot constructor options
   */
  bot?: ClientOptions;
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
