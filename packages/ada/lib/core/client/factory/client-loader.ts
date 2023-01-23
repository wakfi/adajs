import { walkDirectory } from '@ada/lib/utils/helpers';
import { ResolvedAdaConfig, CommandEntry, CommandConfig } from '@ada/types';
import { AdaConfig } from '@config/types';
import {
  ApplicationCommandType,
  ClientOptions,
  Interaction,
  InteractionType,
  PermissionsString,
  Permissions,
  PermissionFlagsBits,
  APIApplicationCommand,
  ApplicationCommandOptionType,
  Collection,
  ApplicationCommandSubGroup,
  ApplicationCommandSubCommand,
} from 'discord.js';
import { AdaClient } from '../AdaClient';
import { basename, extname, dirname, relative, sep } from 'path';
import { inferredNameSym, namePathSym } from '@ada/lib/utils/private-symbols';
import { setInternalClient } from '@ada/lib/utils/state';
import { executeFile, HandlerFileExports } from '@ada/lib/utils/vm';
import { strcmp, tryIgnore } from 'shared/utils/helpers';

// TODO Move to a constants file
export const discordApi = 'https://discord.com/api/v10';
// TODO: Mechanism to limit command publishes to "dev guild(s)" when developing, rather than publishing to everything
const globalRegisterEndpoint = (id: Maybe<string>) =>
  id ? `${discordApi}/applications/${id}/commands` : null;
const guildRegisterEndpoint = (id: Maybe<string>, guildId: Maybe<string>) =>
  id && guildId ? `${discordApi}/applications/${id}/guilds/${guildId}/commands` : null;
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
        cache: 'no-store',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${token}`,
        },
      })
    : console.log(
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

// todo: extract to constants
const UNHANDLED_COMMAND =
  'Sorry, something went wrong while handling that command. If this problem persists, please let my developer know!';
const UNKNOWN_ERROR = UNHANDLED_COMMAND;

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
  default:
    // Trigger type error when a property hasn't been added to this switch yet.
    // This assignment is legal if |k| is typed as `never`, and that only happens
    // if the cases are exhaustive. If a new property gets added, the switch won't
    // be exhaustive anymore and this assignment will trigger a type error until
    // the case(s) are added to make it exhaustive again
    const _b: never = k;
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

export const ensureCommand = (
  exports: HandlerFileExports,
  { filepath = '', commandsDir = '' } = {}
): Optional<CommandEntry> => {
  const {
    config = {} as any,
    default: defaultExport,
    handler: handlerExport,
  }: HandlerFileExports = exports;

  console.log('in exports found', {
    config,
    defaultExport,
    handlerExport,
  });

  // config.disable
  config.disable = !!config.disable;

  let handler = config.disable ? () => {} : handlerExport || defaultExport;
  if (!handler) {
    console.warn(
      'Missing handler. Commands must export a function, either named "handler" or as the default export',
      filepath
    );
    handler = () => {};
    // return;
  }
  if (typeof handler !== 'function') {
    console.warn('Handler is not a function', filepath);
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
        console.error(
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
    config.description = 'Missing description';
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
      .map((s) => [s, config[s]]),
  ];

  return Object.setPrototypeOf(
    Object.fromEntries(commandEntryProps),
    null
  ) as CommandEntry;
};

async function readCommands(config: ResolvedAdaConfig): Promise<CommandEntry[]> {
  console.log('readCommands');
  const { commandsDir } = config;
  const discoveredCommands: Maybe<CommandEntry>[] = await walkDirectory(
    ({ body, filepath }) => {
      console.log(
        'Walking, at file',
        filepath,
        relative(commandsDir, filepath).split(sep)
      );

      // Execute file in VM sandbox
      const exported = executeFile({ body, filepath });
      if (!exported) {
        console.error('no exports', { exports: exported, filepath, body });
        return;
      }
      return ensureCommand(exported, {
        filepath,
        commandsDir,
      });
    },
    {
      path: commandsDir,
      recursive: true,
    }
  );
  return discoveredCommands.filter((v): v is NonNullable<typeof v> => !!v);
}

const constructClient = (bot: ClientOptions): AdaClient => new AdaClient(bot);

export type InteractionOfCommand = Interaction & {
  type:
    | InteractionType.ApplicationCommand
    | InteractionType.ApplicationCommandAutocomplete;
};

function patchClient(client: AdaClient, commands: CommandEntry[]) {
  console.log('patchClient');
  for (const command of commands) {
    console.log('for command', command);
    client.addCommand(command, command[namePathSym]);
  }
  if (process.env.ADA_ENV === 'test') {
    // Override the `login` method to be no-op in test environment
    Object.defineProperty(client, 'login', {
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

  console.log('converting', command);

  for (let i = 0; i < options.length; ++i) {
    const option = options[i];
    if (option.type > 2) {
      break;
    }
    options[i] = entryToApiCommand(options[i] as any) as unknown as
      | ApplicationCommandSubGroup
      | ApplicationCommandSubCommand;
    // @ts-expect-error
    if (options[i].options?.[i]?.type === 1) {
      options[i].type = 2;
    }
  }

  const apiCommand: APICommand = {
    default_member_permissions: defaultPermissions ? `${defaultPermissions}` : null,
    description,
    name,
    type,
    dm_permission: directMessage,
    ...elide({ options }, (o) => !o?.length),
    ...elide({ nsfw }),
    ...elide({ name_localizations: localizations.name }),
    ...elide({ description_localizations: localizations.description }),
  };

  if (type !== ApplicationCommandType.ChatInput) {
    apiCommand.description = '';
  }

  console.log('result it', apiCommand);

  return apiCommand;
};

// The code in this function is heavily based on the logic used in Bulbbot for this purpose
// https://github.com/TeamBulbbot/bulbbot/blob/3729f970dfbe271995b07887bb09b77c38adc245/src/utils/InteractionCommands.ts
async function maybeRegisterCommands(
  client: AdaClient,
  commands: CommandEntry[],
  config: AdaConfig
) {
  console.log('maybeRegisterCommands');
  if (config.autoRegisterCommands !== true) {
    return;
  }

  console.log('will register', commands);

  // TODO: Auto register the commands
  const apiCommands = commands
    .map(entryToApiCommand)
    .filter((x): x is NonNullable<typeof x> => !!x);

  const endpoint = globalRegisterEndpoint(config.clientId);
  if (!endpoint || !config.token) {
    return;
  }
  console.log(
    'will register',
    JSON.stringify(
      apiCommands,
      (k, v) => {
        if (typeof v === 'bigint') {
          console.log({ [k]: v });
          return `${v}`;
        }
        return v;
      },
      2
    )
  );
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
  console.log('maybeErrorReply');
  if (interaction.isRepliable() && !interaction.replied) {
    // TODO: Allow custom error message
    // TODO: Allow bubbling of error
    // TODO: Create a way to register callback to run whenever an error happens. Maybe alternative to bubbling
    //       Maybe a hook would make sense here? Unlikely
    await tryIgnore(async () => interaction.deferReply({ ephemeral: true }));
    interaction.followUp({ content: replyMessage, ephemeral: true });
  }
}

function addClientListeners(client: AdaClient): void {
  console.log('addClientListeners');
  client.on('interactionCreate', async (interaction) => {
    console.log(interaction);
    switch (interaction.type) {
      case InteractionType.ApplicationCommand:
      case InteractionType.ApplicationCommandAutocomplete: {
        const handler = client.findCommand(interaction);
        if (!handler) {
          maybeErrorReply(interaction, UNHANDLED_COMMAND);
          throw new Error(`No handler defined for command "${interaction.commandName}"`);
        }
        // TODO: Setup hooks
        try {
          // TODO: Will we use the return value?
          await handler(interaction);
        } catch (e) {
          console.error(e);
          maybeErrorReply(interaction, UNKNOWN_ERROR);
        }
        break;
      }
      case InteractionType.MessageComponent:
        console.log('got a message component');
        console.log(interaction);
        break;
      case InteractionType.ModalSubmit:
        console.log('got a modal submit');
        console.log(interaction);
        break;
      default:
        // This creates a typechecker error when there's an unhandled switch case
        const _unhandledCase: never = interaction;
        throw new Error(
          `Encountered unknown bot interaction type: "${
            // @ts-expect-error Should only be possible to execute if the type checking here is wrong
            InteractionType[interaction.type]
          }"`
        );
    }
  });
}

function setupClient(client: AdaClient, commands: CommandEntry[]) {
  console.log('setupClient');
  patchClient(client, commands);
  addClientListeners(client);
}

export const makeClient = async (config: ResolvedAdaConfig): Promise<AdaClient> => {
  console.log('makeClient');
  const commands = await readCommands(config);
  console.log('constructClient');
  const client = constructClient(config.bot);
  setupClient(client, commands);
  const toRegister = [...client.globalCommands.entries()]
    .filter(([k]) => typeof k !== 'symbol')
    .map(([, v]) => (v instanceof Collection ? (v.get('.') as CommandEntry) : v));
  let r = await maybeRegisterCommands(client, toRegister, config);
  if (r && !r.ok) {
    // if (r) {
    r.json()
      .then((t) =>
        console.log(r!.status, 'response text:\n\n', JSON.stringify(t, null, 2), '\n')
      )
      .then(() => {
        throw new Error('Registration error');
      });
  }
  console.log('finished makeClient');
  setInternalClient(client);
  return client;
};
