import { collectionPathSym, namePathSym } from '@ada/lib/utils/private-symbols';
import { ApplicationCommandOptionType, Client, Collection } from 'discord.js';
import { ensureCommand, InteractionOfCommand } from './factory/client-loader';
import { deepcopy } from 'shared/modules/esm-tools/helpers.mjs';
import type {
  CommandEntry,
  CommandsCollection,
  DebugOptions,
  ResolvedAdaConfig,
} from '@ada/types';
import type { FSWatcher } from 'chokidar';
import { createLogger, verbose } from '@ada/lib/utils/logging';
import { collectionToObject } from '@ada/lib/utils/helpers';

const WHITESPACE_REGEX = /\s+/;
const subcommandRefSym = Symbol('subcommandRef');

// Using `public guildCommands: CommandsCollection` instead of a type assertion yields a type error
const commandCollection = (collectionPath: string[] = []) => {
  const c = new Collection() as CommandsCollection;
  c.set(collectionPathSym, collectionPath);
  return c;
};

const placeholderCommand = (name: string) =>
  ensureCommand({
    config: {
      name,
      type: 1,
      // @ts-expect-error
      [subcommandRefSym]: undefined as any,
    },
    handler: () => {},
  })!;

export class AdaClient extends Client {
  public readonly guildCommands = commandCollection();
  public readonly globalCommands = commandCollection();
  public readonly autoRegistrationCache: Record<string, string> = {};
  public readonly config: Omit<ResolvedAdaConfig, 'token'> & { token: undefined };
  // Not available until after `watchCommands` is called, if applicable
  public readonly watcher: Optional<FSWatcher>;
  private readonly logger: Record<keyof DebugOptions, Console>;

  public constructor(config: ResolvedAdaConfig) {
    super(config.bot);
    if (config.token) {
      // Ensure the token is populated
      this.token = config.token;
    }
    this.config = {
      ...deepcopy(config),
      // We omit the token here to reduce the risk of it being accidentally leaked. Less copies of the token floating around
      // is better for security. The base Client already has the token so we can internally retrieve it when needed, and
      // developers are more likely to know about that one than this one (so they will know to redact it when needed)
      token: undefined,
    };
    this.watcher = undefined;
    this.logger = {} as any;
    for (const label in config.debug) {
      this.logger[label] = createLogger(() => config.debug[label], { label });
    }
  }

  override async destroy() {
    if (this.watcher) {
      await this.watcher.close();
    }
    return await super.destroy();
  }

  public addCommand(command: CommandEntry, namePath: string | string[], upsert = false) {
    const { global: isGlobal } = command;
    // if (command[namePathSym].length > 3) {
    //   throw new Error('Discord only supports at most 2 levels of subcommand nesting');
    // }
    const [currentEntry, key, collection] = this.findCommandReference(namePath, isGlobal);
    const collectionPath = collection.get(collectionPathSym)!;
    if (currentEntry) {
      verbose.log('path 1', key);
      const currentEntryNamepath = currentEntry[namePathSym];
      const newEntryNamepath = command[namePathSym];
      if (!collectionPath) {
        // This length comparison indicates that the |currentEntry| is at the end of its path,
        // and cannot be replaced by a further chain of collections
        // as there aren't any more keys to use for the corresponding CommandEntry
        this.logger.commands.warn(`"${key}" already exists in commands collection`);
        return;
      }
      // The |currentEntry| is not yet at the end of its path, so we can try to go deeper
      let currentCollection = collection;
      let i = collectionPath.length;
      const len = Math.min(currentEntryNamepath.length, newEntryNamepath.length);
      verbose.log('remapping loop');
      for (; i < len; ++i) {
        verbose.log(
          `${currentEntryNamepath[i]} !== ${newEntryNamepath[i]}`,
          currentEntryNamepath,
          newEntryNamepath
        );
        if (currentEntryNamepath[i] !== newEntryNamepath[i]) {
          break;
        }
        const newCollection = commandCollection(currentEntryNamepath.slice(0, i + 1));
        currentCollection.set(currentEntryNamepath[i], newCollection);
        currentCollection = newCollection;
      }
      if (i === len) {
        if (currentEntryNamepath[i] === newEntryNamepath[i]) {
          if (newEntryNamepath.length === currentEntryNamepath.length) {
            if (upsert) {
              const oldOptions = currentEntry.options;
              const newOptions = command.options;
              const mergedOptions = [
                ...newOptions,
                // Subcommand options are automatically controlled so we need to retain them. All other options come from the developer.
                // It likely doesn't make sense to have any other options an a command with subcommands, but this implementation is nice
                ...oldOptions.filter(
                  ({ type }) => type === ApplicationCommandOptionType.Subcommand
                ),
              ];
              command.options = mergedOptions;
              collection.set(key, command);
              return;
            }
            // This length comparison indicates that the |currentEntry| and |entry| have identical
            // namepaths, i.e. a collision. This means that two commands have the same path
            // (command name + subcommand names).
            this.logger.commands.error(
              `Collision on command namepath "${newEntryNamepath.join(' ')}"`
            );
            // Rollback & return
            collection.set(key, currentEntry);
            return;
          }
          // Indicates the paths are identical, except one is longer than the other. In other words,
          // one namepath is a strict subset of the other
          const newCollection = commandCollection(currentEntryNamepath.slice(0, i + 1));
          currentCollection.set(key, newCollection);
        }
        // Files cannot be named `.`, it is reserved by the OS as a reference to the current directory
        // meaning this can never collide with a real file name. And if you ever manually name a command
        // `.`, you deserve the collision. Use a real name
        if (currentEntryNamepath.length === len) {
          currentCollection.set('.', currentEntry);
          currentCollection.set(newEntryNamepath[i], command);

          currentEntry.options.unshift(
            command as CommandEntry & {
              type: ApplicationCommandOptionType.Subcommand;
            }
          );
        } else {
          currentCollection.set('.', command);
          currentCollection.set(currentEntryNamepath[i], currentEntry);

          command.options.unshift(
            currentEntry as CommandEntry & {
              type: ApplicationCommandOptionType.Subcommand;
            }
          );
        }
      }
    } else if (collectionPath.length === command[namePathSym].length - 1) {
      verbose.log('path 2', key);
      collection.set(key, command);
      const currentEntry = collection.get('.') as Optional<CommandEntry>;
      if (currentEntry) {
        currentEntry.options.unshift(
          command as CommandEntry & {
            type: ApplicationCommandOptionType.Subcommand;
          }
        );
      }
    } else {
      // TODO: Is this unreachable? What is this case handling? Something to do with subcommands?
      verbose.log('path 3', key);
      verbose.log(`${collectionPath} !== ${command[namePathSym]}`);
      const intermediate = commandCollection([...collectionPath, key]);
      const fakeParent = placeholderCommand(key);
      const topCommand = collection.get('.');
      if (topCommand) {
        topCommand.options.unshift(
          fakeParent as CommandEntry & {
            type: ApplicationCommandOptionType.Subcommand;
          }
        );
      }
      // Technically we could use the knowledge of the limited nesting to finish
      // the mapping right here, but doing it this way keeps it robust in case
      // Discord ever expands that restriction any
      intermediate.set('.', fakeParent);
      collection.set(key, intermediate);
      verbose.log('intermediate', collectionToObject(intermediate));
      verbose.log('collection', collectionToObject(collection));
      // this.addCommand(command, namePath);
    }
  }

  public removeCommand(namePath: string | string[], isGlobal?: boolean): boolean {
    const [command, key, collection] = this.findCommandReference(namePath, isGlobal);
    if (!command) {
      this.logger.commands.warn('Command not found at', namePath);
      return false;
    }
    if (key === '.') {
      const [, , parentCollection] = this.findCommandReference(
        // '..' is an OS reserved name so it shouldn't collide with any real command name
        [...namePath.slice(0, -1), '..'],
        isGlobal
      );
      const collectionKey = namePath[namePath.length - 1];
      if (!parentCollection.has(collectionKey)) {
        throw new Error('This should be logically unreachable');
      }
      this.logger.commands.log(
        'Removing',
        collectionToObject(collection),
        'at',
        namePath
      );
      return parentCollection.delete(collectionKey);
    }
    this.logger.commands.log('Removing', command, 'at', namePath);
    return collection.delete(key);
  }

  /**
   * Return the command if it exists, and also return the collection and key it can be accessed at regardless of whether the command exists.
   * This is useful for abstracting the work of finding the command for various needs such as adding, deleting, and finding
   * @param namePath The namepath of the command to find, as a string or array of strings. If a string, it will be split on whitespace
   * @param isGlobal True to check global commands, false for guildCommands, undefined to check guildCommands first, then globalCommands
   * @returns
   */
  public findCommandReference(
    namePath: string | string[],
    isGlobal?: boolean
  ): [Optional<CommandEntry>, string, CommandsCollection] {
    let commands = isGlobal ? this.globalCommands : this.guildCommands;
    const names = Array.isArray(namePath) ? namePath : namePath.split(WHITESPACE_REGEX);
    let [key] = names;
    let entry: Optional<CommandEntry>;
    for (let i = 0; i < names.length; ++i) {
      verbose.log('Querying', key, 'in', collectionToObject(commands));
      key = names[i];
      const collectionEntry = commands.get(key);
      verbose.log('Got entry', collectionEntry, '\n');
      if (typeof collectionEntry === 'undefined') {
        break;
      }
      if (!(collectionEntry instanceof Collection)) {
        entry = collectionEntry;
        break;
      }
      commands = collectionEntry;
    }
    if (entry) {
      return [entry, key, commands];
    }
    if (commands) {
      if (
        key ===
          commands.get(collectionPathSym)![commands.get(collectionPathSym)!.length - 1] &&
        names.length === commands.get(collectionPathSym)!.length
      ) {
        verbose.log('Using topCommand');
        entry = commands.get('.');
      }
      if (entry) {
        return [entry, '.', commands];
      }
    }
    if (typeof isGlobal !== 'undefined') {
      return [entry, key, commands];
    }
    // isGlobal was undefined. Default behavior in such case is to search guildCommands first, then globalCommands
    return this.findCommandReference(namePath, true);
  }

  public findCommand(interaction: InteractionOfCommand): Optional<BasicCallable> {
    const isGlobal = interaction.commandGuildId === null;
    // TODO: Traverse options as needed
    const namePath: string[] = [interaction.commandName];

    verbose.log(interaction.options.data, interaction.options.resolved);
    const [subLevelOne] = interaction.options.data;

    if (subLevelOne?.type < 3) {
      namePath.push(subLevelOne.name);
      if (subLevelOne.type === 2) {
        const [subLevelTwo] = subLevelOne.options!;
        // Opt is a group, not a subcommand, therfore groupChildOpt is a subcommand
        namePath.push(subLevelTwo.name);
      }
    }

    verbose.log(interaction, interaction.commandName);
    const [command] = this.findCommandReference(namePath, isGlobal);
    this.logger.commands.log('found', command, 'for', namePath);
    return command?.handler;
  }
}
