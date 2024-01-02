import { watch } from 'chokidar';
import {
  APIApplicationCommand,
  APIApplicationCommandOption,
  APIApplicationCommandSubcommandGroupOption,
  APIApplicationCommandSubcommandOption,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  Collection,
  Interaction,
  InteractionType,
  PermissionFlagsBits,
  PermissionsString,
} from 'discord.js';
import { readFile } from 'fs/promises';
import { sleep, strcmp, tryIgnore } from 'lib/utils/helpers';
import { basename, dirname, extname, relative, sep } from 'path';
import { UNHANDLED_COMMAND, UNKNOWN_ERROR } from 'src/errors/user-facing/constants';
import {
  AdaConfig,
  CommandConfig,
  CommandEntry,
  CommandsCollection,
  ResolvedAdaConfig,
} from 'src/types';
import { DISCORD_API } from 'src/utils/constants';
import { walkDirectory } from 'src/utils/helpers';
import { createLogger, DEBUG_VERBOSE, verbose } from 'src/utils/logging';
import { inferredNameSym, namePathSym } from 'src/utils/private-symbols';
import { setInternalClient } from 'src/utils/state';
import { executeFile, HandlerFileExports } from 'src/utils/vm';
import { AdaClient } from '../AdaClient';

// TODO: BREAK THIS FILE UP

const DEBUG = {
  LOADER: false,
  COMMANDS: false,
  AUTO_REGISTER: false,
  MESSAGES: false,
  INTERACTIONS: false,
  HOT_RELOAD: false,
};
const logger = {
  loader: createLogger(() => DEBUG.LOADER, { label: 'loader' }),
  commands: createLogger(() => DEBUG.COMMANDS, { label: 'commands' }),
  autoRegister: createLogger(() => DEBUG.AUTO_REGISTER, { label: 'autoRegister' }),
  messages: createLogger(() => DEBUG.MESSAGES, { label: 'messages' }),
  interaction: createLogger(() => DEBUG.INTERACTIONS, { label: 'interactions' }),
  hotReload: createLogger(() => DEBUG.HOT_RELOAD, { label: 'hotReload' }),
};

// TODO: Mechanism to limit command publishes to "dev guild(s)" when developing, rather than publishing to everything
const globalRegisterEndpoint = (id: Maybe<string>) =>
  id ? `${DISCORD_API}/applications/${id}/commands` : null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const guildRegisterEndpoint = (id: Maybe<string>, guildId: Maybe<string>) =>
  id && guildId ? `${DISCORD_API}/applications/${id}/guilds/${guildId}/commands` : null;
const register = ({
  commands,
  endpoint,
  token,
}: {
  commands: APICommand[];
  endpoint: string;
  token: string;
}) =>
  process.env.ADA_ENV !== 'test'
    ? fetch(endpoint, {
        body: JSON.stringify(commands),
        // cache: 'no-store',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${token}`,
          'Cache-Control': 'no-store',
        },
      })
    : logger.autoRegister.log(
        'would have registered: fetch(',
        endpoint,
        {
          body: JSON.stringify(commands),
          cache: 'no-store',
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${token}`,
          },
        },
        ')'
      );

// If you add a new CommandConfig prop that needs to be resolved, add it here
// after add the resolution handling
let k!: keyof CommandConfig;
switch (k) {
  case 'disable':
  case 'global':
  case 'name':
  case 'localizations':
  case 'description':
  case 'type':
  case 'clientPermissions':
  case 'defaultPermissions':
  case 'options':
  case 'limitAccess':
  case 'directMessage':
  case 'nsfw':
    break;
  default: {
    // Trigger type error when a property hasn't been added to this switch yet.
    // This assignment is legal if |k| is typed as `never`, and that only happens
    // if the cases are exhaustive. If a new property gets added, the switch won't
    // be exhaustive anymore and this assignment will trigger a type error until
    // the case(s) are added to make it exhaustive again
    const _b: never = k;
  }
}

const elide = <K extends keyof any, V>(
  obj: { [P in K]: V },
  predicate?: (v: V) => boolean
): Optional<{
  [P in K]: V;
}> => {
  for (const key in obj) {
    if (predicate ? predicate(obj[key]) : !obj[key]) return undefined;
    return { [key]: obj[key] } as any;
  }
};

const permissionStringsToBits = (perms: PermissionsString[] = []): bigint | null =>
  perms.reduce((acc, perm) => acc | PermissionFlagsBits[perm], 0n);

const namesPathFromFilePath = (filepath: string, commandsDir: string): string[] => {
  const relativeFilepath = relative(commandsDir, filepath);
  const namesPath = relativeFilepath.split(sep);
  const candidate = basename(relativeFilepath, extname(relativeFilepath));
  if (candidate === 'index') {
    namesPath.pop();
  } else {
    namesPath[namesPath.length - 1] = candidate;
  }
  return namesPath;
};

export const ensureCommand = (
  exports: HandlerFileExports,
  { filepath = '', commandsDir = '', silent } = { silent: false }
): Optional<CommandEntry> => {
  const {
    config = {} as any,
    default: defaultExport,
    handler: handlerExport,
  }: HandlerFileExports = exports;

  DEBUG.COMMANDS &&
    verbose.log('in exports found', {
      config,
      defaultExport,
      handlerExport,
    });

  // config.disable
  config.disable = !!config.disable;

  let handler = config.disable ? () => {} : handlerExport || defaultExport;
  if (!handler) {
    // if (silent) {
    //   return;
    // }
    logger.commands.warn(
      'Missing handler. Commands must export a function, either named "handler" or as the default export',
      `\n    at "${filepath}"`
    );
    handler = () => {};
    // return;
  }
  if (typeof handler !== 'function') {
    // if (silent) {
    //   return;
    // }
    logger.commands.warn('Handler is not a function', filepath);
    handler = () => {};
    // return;
  }

  const relativeFilepath = relative(commandsDir, filepath);
  // config.name
  if (!config.name) {
    // Fallback to the name of the command file
    config[inferredNameSym] = config.name = basename(
      relativeFilepath,
      extname(relativeFilepath)
    );
    if (config.name === 'index') {
      // If the filename is index, fallback to the name of the directory instead
      config.name = basename(dirname(relativeFilepath));
      if (!config.name) {
        !silent &&
          logger.commands.error(
            `index at the root of the commands directory has no meaning: "${relativeFilepath}"`
          );
        return;
      }
    }
  } else {
    config.name = String(config.name);
    config[inferredNameSym] = undefined!;
  }
  const namesPath = relativeFilepath.split(sep);
  if (!config[inferredNameSym]?.endsWith('index')) {
    namesPath[namesPath.length - 1] = config.name;
  } else {
    // If we use name inference and the filename was index, we use the directory name
    // so we need to pop the filename (index) out of the command names path
    namesPath.pop();
  }
  config[namePathSym] = namesPath;

  // Unimplemented. Need to figure out how to deal with non-globals in a way that
  // is intuitive/sensible/reasonable/easy to work with
  // config.global
  // config.global = !!config.global;
  config.global = true;

  // config.localizations
  config.localizations = {
    // Object-spread is null-safe. It's actually safe for all falsy values
    ...config.localizations,
  };

  // config.description
  if (config.description === undefined) {
    config.description = 'No description';
  }
  config.description = String(config.description);

  // config.type
  if (config.type === undefined) {
    // Default to slash command
    config.type = ApplicationCommandType.ChatInput;
  }

  // config.defaultPermissions
  // @ts-expect-error Don't worry about it
  config.defaultPermissions = permissionStringsToBits(config.defaultPermissions);

  // config.clientPermissions
  // @ts-expect-error Don't worry about it
  config.clientPermissions = permissionStringsToBits(config.clientPermissions);

  // config.options
  config.options = config.options || [];

  // config.directMessage
  config.directMessage = !!config.directMessage;

  // config.limitAccess
  // If the key isn't present, this causes the key to be present and explicitly undefined
  // eslint-disable-next-line no-self-assign
  config.limitAccess = config.limitAccess;

  // config.nsfw
  config.nsfw = !!config.nsfw;

  // TODO: Optimize this array creation. Too much iteration involved
  // We are controlling the property order like this so the CommandEntry object
  // produced has a consistent Shape in V8's internal systems. V8 Shapes are
  // sometimes referred to as "hidden classes", all objects have a Shape, and
  // there are benefits to having a consistent Shape. This is something that
  // libraries and frameworks sometimes pay attention to, but most normal
  // application code shouldn't need to be concerned with this concept
  const commandEntryProps = [
    ['handler', handler],
    ...Object.entries(config).sort(([a], [b]) => strcmp(a, b)),
    ...Object.getOwnPropertySymbols(config)
      .sort((a, b) => strcmp(a.description, b.description))
      .map((s) => [s, config[s as keyof typeof config]]),
  ];

  return Object.setPrototypeOf(
    Object.fromEntries(commandEntryProps),
    null
  ) as CommandEntry;
};

function readCommand(
  body: string,
  filepath: string,
  commandsDir: string,
  // We want silence for hotreloading, so that a new file that isn't complete can be ignored until it's got something valid
  silent: boolean
) {
  logger.commands.log(
    'Reading command',
    filepath,
    relative(commandsDir, filepath).split(sep)
  );

  // Execute file in VM sandbox
  const exported = executeFile({ body, filepath });
  if (!exported) {
    !silent && logger.commands.error('no exports', { exports: exported, filepath, body });
    return;
  }
  const normalized = ensureCommand(exported, {
    filepath,
    commandsDir,
    silent,
  });
  logger.hotReload.log('normalized command', normalized);
  return normalized;
}

async function readCommands(config: ResolvedAdaConfig): Promise<CommandEntry[]> {
  logger.loader.log('readCommands');
  const { commandsDir } = config;
  const discoveredCommands: Maybe<CommandEntry>[] = await walkDirectory(
    ({ body, filepath }) => readCommand(body, filepath, commandsDir, false),
    {
      path: commandsDir,
      recursive: true,
    }
  );
  return discoveredCommands.filter((v): v is NonNullable<typeof v> => !!v);
}

export type InteractionOfCommand = Interaction & {
  type:
    | InteractionType.ApplicationCommand
    | InteractionType.ApplicationCommandAutocomplete;
};

function patchClient(client: AdaClient, commands: CommandEntry[]) {
  logger.loader.log('patchClient');
  for (const command of commands) {
    logger.commands.log(
      'adding command',
      command[namePathSym],
      DEBUG_VERBOSE ? command : ''
    );
    client.addCommand(command, command[namePathSym]);
  }
  logger.loader.log('loaded all commands');
  if (process.env.ADA_ENV === 'test') {
    // Override the `login` method to be no-op in test environment
    Object.defineProperty(client, 'login', {
      // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
      value: async (token: string) => '',
      enumerable: true,
      configurable: true,
      writable: false,
    });
  }
}

type APICommand = Omit<APIApplicationCommand, 'id' | 'application_id' | 'version'>;
export const entryToApiCommand = (command: CommandEntry): Optional<APICommand> => {
  const {
    defaultPermissions,
    description,
    directMessage,
    disable,
    localizations,
    name,
    nsfw,
    options,
    type,
  } = command;

  if (disable) {
    return;
  }

  DEBUG.AUTO_REGISTER && verbose.log('converting', command);

  const apiOptions = options.map((option) => {
    if (option.type > ApplicationCommandOptionType.SubcommandGroup) {
      // Other options are already API-compatible
      return option;
    }
    const subcommandOption = entryToApiCommand(option as any) as unknown as
      | APIApplicationCommandSubcommandGroupOption
      | APIApplicationCommandSubcommandOption;

    if (
      subcommandOption.options?.some(
        ({ type }) => type === ApplicationCommandOptionType.Subcommand
      )
    ) {
      // An option is a subcommand group if it has further subcommands
      subcommandOption.type = ApplicationCommandOptionType.SubcommandGroup;
    }
    return subcommandOption;
  }) as APIApplicationCommandOption[];

  const apiCommand: APICommand = {
    default_member_permissions: defaultPermissions ? `${defaultPermissions}` : null,
    description,
    name,
    type,
    dm_permission: directMessage,
    ...elide({ options: apiOptions }, (o) => !o?.length),
    ...elide({ nsfw }),
    ...elide({ name_localizations: localizations.name }),
    ...elide({ description_localizations: localizations.description }),
  };

  if (type !== ApplicationCommandType.ChatInput) {
    apiCommand.description = '';
  }

  DEBUG.AUTO_REGISTER && verbose.log('result is', apiCommand);

  return apiCommand;
};

// The code in this function is heavily based on the logic used in Bulbbot for this purpose
// https://github.com/TeamBulbbot/bulbbot/blob/3729f970dfbe271995b07887bb09b77c38adc245/src/utils/InteractionCommands.ts
async function maybeRegisterCommands(
  client: AdaClient,
  commands: CommandEntry[],
  config: AdaConfig,
  identifier: string
) {
  logger.autoRegister.log('maybeRegisterCommands');
  if (config.autoRegisterCommands !== true) {
    return;
  }

  DEBUG.AUTO_REGISTER && verbose.log('will register', commands);

  if (identifier === 'guild') {
    logger.autoRegister.log('Registration of guild commands not yet supported, aborting');
    return;
  }

  const apiCommands = commands
    .map(entryToApiCommand)
    .filter((x): x is NonNullable<typeof x> => !!x);

  const endpoint = globalRegisterEndpoint(config.clientId);
  if (!endpoint || !config.token) {
    logger.autoRegister.log('Missing endpoint or token, aborting');
    return;
  }
  const bodyText = JSON.stringify(
    apiCommands,
    (k, v) => {
      if (typeof v === 'bigint') {
        verbose.log('encountered bigint', { [k]: v });
        return `${v}`;
      }
      return v;
    },
    DEBUG.AUTO_REGISTER ? 2 : undefined
  );
  DEBUG.AUTO_REGISTER && verbose.log('will register', bodyText);
  const cached = client.autoRegistrationCache[identifier];
  if (cached === bodyText) {
    logger.autoRegister.log('No changes detected, will not register');
    return;
  }
  // TODO: Persist cache to disk
  client.autoRegistrationCache[identifier] = bodyText;
  // TODO: Support non-global commands
  // TODO: Support limited registration
  // TODO: Support dev-only registration when in dev environments

  return await register({
    commands: apiCommands,
    endpoint,
    token: config.token,
  });
}

async function maybeErrorReply(
  interaction: Interaction & {
    type:
      | InteractionType.ApplicationCommand
      | InteractionType.ApplicationCommandAutocomplete;
  },
  replyMessage = UNKNOWN_ERROR
) {
  logger.messages.log('maybeErrorReply');
  // Avoid race condition if the handler had queued a reply before throwing. This allows the promise queue to clear
  await sleep(500);
  if (interaction.isRepliable()) {
    logger.messages.log('interaction is repliable');
    // TODO: Allow custom error message
    // TODO: Allow bubbling of error
    // TODO: Create a way to register callback to run whenever an error happens. Maybe alternative to bubbling
    //       Maybe a hook would make sense here? Unlikely
    if (!interaction.replied) {
      logger.messages.log('interaction has not been replied to yet');
      await tryIgnore(() => interaction.deferReply({ ephemeral: true }));
      await sleep(500);
      logger.messages.log('interaction is deferred');
    }
    await interaction.followUp({ content: replyMessage, ephemeral: true });
    logger.messages.log('followed up');
  }
}

function addClientListeners(client: AdaClient): void {
  logger.loader.log('addClientListeners');
  client.on('interactionCreate', async (interaction) => {
    logger.interaction.log('interactionCreate', interaction);
    switch (interaction.type) {
      case InteractionType.ApplicationCommand:
      case InteractionType.ApplicationCommandAutocomplete: {
        const handler = client.findCommand(interaction);
        if (!handler) {
          void maybeErrorReply(interaction, UNHANDLED_COMMAND);
          throw new Error(`No handler defined for command "${interaction.commandName}"`);
        }
        // TODO: Setup hooks
        try {
          // TODO: Will we use the return value?
          await handler(interaction, client);
        } catch (e) {
          console.error(e);
          void maybeErrorReply(interaction, UNKNOWN_ERROR);
        }
        break;
      }
      case InteractionType.MessageComponent:
        logger.interaction.log('interaction is a message component');
        break;
      case InteractionType.ModalSubmit:
        logger.interaction.log('interaction is a modal submit');
        break;
      default: {
        // This creates a typechecker error when there's an unhandled switch case
        const _unhandledCase: never = interaction;
        throw new Error(
          `Encountered unknown bot interaction type: "${
            // @ts-expect-error Should only be possible to execute if the type checking here is wrong
            InteractionType[interaction.type]
          }"`
        );
      }
    }
  });
}

function watchCommands(client: AdaClient, config: ResolvedAdaConfig) {
  logger.loader.log('watchCommands');
  if (!config.watch) {
    logger.loader.log('Will not watch commands');
    return;
  }
  const { commandsDir } = config;
  const watcher = watch(
    [
      `${commandsDir}/**/*.ts`,
      `${commandsDir}/**/*.js`,
      `${commandsDir}/**/*.cjs`,
      `${commandsDir}/**/*.mjs`,
    ],
    {
      ignoreInitial: true,
      ignorePermissionErrors: true,
      // We use this by default to avoid spamming the registration API
      atomic: 200,
    }
  );
  const getCommandFromEvent = async (
    path: string,
    callback: (command: CommandEntry) => any
  ) => {
    const body = await readFile(path, 'utf8');
    const command = tryIgnore(readCommand, body, path, commandsDir, true);
    if (!command || command.disable) {
      return;
    }
    await callback(command);
  };
  watcher.on('add', (path) => {
    logger.hotReload.log(`Detected new command at "${path}"`);
    return getCommandFromEvent(path, async (command) => {
      logger.hotReload.log(`Got normalized command`, command);
      client.addCommand(command, command[namePathSym]);
      if (command.global) {
        await maybeRegisterCommands(
          client,
          commandCollectionToRegisterable(client.globalCommands),
          config,
          'global'
        );
      } else {
        await maybeRegisterCommands(
          client,
          commandCollectionToRegisterable(client.guildCommands),
          config,
          'guild'
        );
      }
    });
  });
  watcher.on('change', (path) => {
    logger.hotReload.log(`Detected change in command at "${path}"`);
    return getCommandFromEvent(path, async (command) => {
      logger.hotReload.log(`Got normalized command`, command);
      client.addCommand(command, command[namePathSym], true);

      if (command.global) {
        await maybeRegisterCommands(
          client,
          commandCollectionToRegisterable(client.globalCommands),
          config,
          'global'
        );
      } else {
        await maybeRegisterCommands(
          client,
          commandCollectionToRegisterable(client.guildCommands),
          config,
          'guild'
        );
      }
    });
  });
  const onRemove = async (path: string) => {
    let found = client.removeCommand(path, true);
    if (found) return 'global';

    found = client.removeCommand(path, false);
    if (found) return 'guild';

    const namesPath = namesPathFromFilePath(path, commandsDir);
    found = client.removeCommand(namesPath, true);
    if (found) return 'global';

    found = client.removeCommand(namesPath, false);
    if (found) return 'guild';

    // Expensive traversal to audit all loaded commands and remove any that aren't found
    const discovered = await readCommands(config);
    const globalCommandCopy = new Collection(client.globalCommands) as CommandsCollection;
    const guildCommandCopy = new Collection(client.guildCommands) as CommandsCollection;
    for (const command of discovered) {
      const { global } = command;
      const [currentEntry, key, parent] = client.findCommandReference(
        command[namePathSym],
        global
      );
      if (currentEntry) {
        continue;
      }
      parent.delete(key);
    }

    found = recursivelyRemoveCommands(globalCommandCopy, client);
    if (found) return 'global';

    found = recursivelyRemoveCommands(guildCommandCopy, client);
    if (found) return 'guild';
  };
  watcher.on('unlink', async (path) => {
    logger.hotReload.log(`Detected removal of command at "${path}"`);
    const identifier = await onRemove(path);
    if (identifier) {
      // Update registrations if needed
      await maybeRegisterCommands(
        client,
        commandCollectionToRegisterable(client[`${identifier}Commands`]),
        config,
        identifier
      );
    } else {
      logger.hotReload.log('No command found to remove');
    }
  });
  // TODO: Figure out if we need to handle 'unlinkDir' events, or if files inside a deleted dir will get individual
  //       'unlink' events already. There may be performance benefits of handling the 'unlinkDir' events regardless

  // @ts-expect-error This is where we expect this property to be initialized
  client.watcher = watcher;
  logger.loader.log('Finished watchCommands');
}

function setupClient(client: AdaClient, commands: CommandEntry[]) {
  logger.loader.log('setupClient');
  patchClient(client, commands);
  watchCommands(client, {
    ...client.config,
    // @ts-expect-error
    token: client.config.autoRegisterCommands ? client.token! : undefined,
  });
  addClientListeners(client);
}

const recursivelyRemoveCommands = (
  collection: CommandsCollection,
  client: AdaClient
): boolean => {
  let didRemove = false;
  for (const v of collection.values()) {
    // Actual possible types for values. See definition of `CommandsCollection`
    const entry = v as CommandEntry | CommandsCollection | string[];
    if (entry instanceof Collection) {
      didRemove ||= recursivelyRemoveCommands(entry, client);
    } else if (!Array.isArray(entry)) {
      client.removeCommand(entry[namePathSym], entry.global);
      didRemove = true;
    }
  }
  return didRemove;
};

const commandCollectionToRegisterable = (commands: CommandsCollection) =>
  [...commands.entries()]
    .filter(([k]) => typeof k !== 'symbol')
    .map(([, v]) => (v instanceof Collection ? (v.get('.') as CommandEntry) : v));

export const makeClient = async (config: ResolvedAdaConfig): Promise<AdaClient> => {
  DEBUG.COMMANDS = config.debug.commands;
  DEBUG.LOADER = config.debug.loader;
  DEBUG.AUTO_REGISTER = config.debug.autoRegister;
  DEBUG.MESSAGES = config.debug.messages;
  DEBUG.INTERACTIONS = config.debug.interactions;
  DEBUG.HOT_RELOAD = config.debug.hotReload;

  logger.loader.log('makeClient');
  const commands = await readCommands(config);
  logger.loader.log('constructClient');
  const client = new AdaClient(config);
  setupClient(client, commands);
  const toRegisterGlobal = commandCollectionToRegisterable(client.globalCommands);
  const r = await maybeRegisterCommands(client, toRegisterGlobal, config, 'global');
  if (r && !r.ok) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    r.json()
      .then((t) =>
        logger.autoRegister.log(
          r.status,
          'Registration failed. Response text:\n\n',
          JSON.stringify(t, null, 2),
          '\n'
        )
      )
      .then(() => {
        // TODO: Extract to error utils
        throw new Error('Registration error');
      });
  }
  const toRegisterGuild = commandCollectionToRegisterable(client.guildCommands);
  await maybeRegisterCommands(client, toRegisterGuild, config, 'guild');
  logger.loader.log('finished makeClient');
  setInternalClient(client);
  return client;
};
