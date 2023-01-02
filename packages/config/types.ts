export interface AdaConfig {
  /**
   * Root directory of bot
   * @default '.'
   */
  rootDir?: string;

  /**
   * Commands directory
   * @default `${rootDir}/commands`
   */
  commandsDir?: string;

  /**
   * Whether command registration should be automatically performed using provided command information
   * @default false
   */
  autoRegisterCommands?: boolean;
}
