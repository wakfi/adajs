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
    const b: never = k;
}

const permissionStringsToBits = (perms: PermissionsString[] = []): bigint | null =>
  perms.reduce((acc, perm) => acc | PermissionFlagsBits[perm], 0n);

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
      const exports = executeFile({ body, filepath });
      if (!exports) {
        console.error('no exports', { exports, filepath, body });
        return;
      }
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

      const handler = config.disable ? () => {} : handlerExport || defaultExport;
      if (!handler) {
        console.error(
          'Missing handler. Commands must export a function, either named "handler" or as the default export',
          filepath
        );
        return;
      }
      if (typeof handler !== 'function') {
        console.error('Handler is not a function', filepath);
        return;
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
const entryToApiCommand = (command: CommandEntry): Optional<APICommand> => {
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

  const apiCommand: APICommand = {
    default_member_permissions: defaultPermissions ? `${defaultPermissions}` : null,
    description,
    name,
    type,
    nsfw,
    options,
    dm_permission: directMessage,
    ...(localizations.name ? { name_localizations: localizations.name } : {}),
    ...(localizations.description
      ? { description_localizations: localizations.description }
      : {}),
  };

  if (type !== ApplicationCommandType.ChatInput) {
    apiCommand.description = '';
  }

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

  // TODO: Auto register the commands
  const apiCommands = commands
    .map((command) => entryToApiCommand(command))
    .filter((x): x is NonNullable<typeof x> => !!x);

  const endpoint = globalRegisterEndpoint(config.clientId);
  if (!endpoint || !config.token) {
    return;
  }
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
          handler(interaction);
        } catch (e) {
          console.error(e);
          maybeErrorReply(interaction, UNKNOWN_ERROR);
        }
        break;
      }
      case InteractionType.MessageComponent:
        break;
      case InteractionType.ModalSubmit:
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
  let r = await maybeRegisterCommands(client, commands, config);
  // r && r.text().then((t) => console.log('response text:\n\n', t, '\n'));
  console.log('finished makeClient');
  setInternalClient(client);
  return client;
};
