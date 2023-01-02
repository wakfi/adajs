import type { ClientOptions } from 'discord.js';

export interface AdaConfig {
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
}
