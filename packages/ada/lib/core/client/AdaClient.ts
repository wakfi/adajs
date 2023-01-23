import { collectionPathSym, namePathSym } from '@ada/lib/utils/private-symbols';
import { ApplicationCommandOptionType, Client, Collection } from 'discord.js';
import type { CommandEntry, CommandsCollection } from '@ada/types';
import {
  ensureCommand,
  entryToApiCommand,
  InteractionOfCommand,
} from './factory/client-loader';

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

  public addCommand(command: CommandEntry, namePath: string | string[]) {
    const { global: isGlobal } = command;
    // if (command[namePathSym].length > 3) {
    //   throw new Error('Discord only supports at most 2 levels of subcommand nesting');
    // }
    const [currentEntry, key, collection] = this.findCommandReference(namePath, isGlobal);
    const collectionPath = collection.get(collectionPathSym)!;
    if (currentEntry) {
      console.log('path 1', key);
      const currentEntryNamepath = currentEntry[namePathSym];
      const newEntryNamepath = command[namePathSym];
      if (!collectionPath) {
        // This length comparison indicates that the |currentEntry| is at the end of its path,
        // and cannot be replaced by a further chain of collections
        // as there aren't any more keys to use for the corresponding CommandEntry
        console.warn(`"${key}" already exists in commands collection`);
        return;
      }
      // The |currentEntry| is not yet at the end of its path, so we can try to go deeper
      let currentCollection = collection;
      let i = collectionPath.length;
      const len = Math.min(currentEntryNamepath.length, newEntryNamepath.length);
      console.log('remapping loop');
      for (; i < len; ++i) {
        console.log(
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
            // This length comparison indicates that the |currentEntry| and |entry| have identical
            // namepaths, i.e. a collision. This means that two commands have the same path
            // (command name + subcommand names).
            console.error(
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
      console.log('path 2', key);
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
      console.log('path 3', key);
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
      this.addCommand(command, namePath);
    }
  }

  public removeCommand(namePath: string, isGlobal?: boolean): boolean {
    const [command, key, collection] = this.findCommandReference(namePath, isGlobal);
    if (!command) {
      return false;
    }
    return collection.delete(key);
  }

  // Return the command if it exists, and also return the collection and key it can be accessed at regardless of whether the command exists.
  // This is useful for abstracting the work of finding the command for various needs such as adding, deleting, and finding
  private findCommandReference(
    namePath: string | string[],
    isGlobal?: boolean
  ): [Optional<CommandEntry>, string, CommandsCollection] {
    let commands = isGlobal ? this.globalCommands : this.guildCommands;
    const names = Array.isArray(namePath) ? namePath : namePath.split(WHITESPACE_REGEX);
    let [key] = namePath;
    let entry: Optional<CommandEntry>;
    for (let i = 0; i < names.length; ++i) {
      key = names[i];
      const collectionEntry = commands.get(key);
      if (typeof collectionEntry === 'undefined') {
        break;
      }
      if (!(collectionEntry instanceof Collection)) {
        entry = collectionEntry;
        break;
      }
      commands = collectionEntry;
    }
    if (entry || typeof isGlobal !== 'undefined') {
      return [entry, key, commands];
    }
    // isGlobal was undefined. Default behavior in such case is to search guildCommands first, then globalCommands
    return this.findCommandReference(namePath, true);
  }

  public findCommand(interaction: InteractionOfCommand): Optional<BasicCallable> {
    const isGlobal = interaction.commandGuildId === null;
    // TODO: Traverse options as needed
    const namePath: string[] = [interaction.commandName];

    console.log(interaction.options.data, interaction.options.resolved);
    const [subLevelOne] = interaction.options?.data;

    if (subLevelOne?.type < 3) {
      namePath.push(subLevelOne.name);
      if (subLevelOne.type === 2) {
        const [subLevelTwo] = subLevelOne.options!;
        // Opt is a group, not a subcommand, therfore groupChildOpt is a subcommand
        namePath.push(subLevelTwo.name);
      }
    }

    // console.log(interaction, interaction.commandName);
    const [command] = this.findCommandReference(namePath, isGlobal);
    console.log('found', command, 'for', namePath);
    return command?.handler;
  }
}
