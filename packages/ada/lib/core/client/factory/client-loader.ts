import { walkDirectory } from '@ada/lib/utils/helpers';
import { ResolvedAdaConfig, DiscoveredCommand } from '@ada/types';
import { AdaConfig } from '@config/types';
import { ClientOptions, Interaction, InteractionType } from 'discord.js';
import { AdaClient } from './AdaClient';
import { runInContext, createContext } from 'vm';
import { basename, extname, dirname } from 'path';

const commandHandlersContext = createContext(
  { module: { exports: {} }, exports: {} },
  {
    name: 'Command Handlers',
    microtaskMode: 'afterEvaluate',
  }
);

const resetContext = () =>
  runInContext('module={exports:{}};exports={};', commandHandlersContext);

// todo: extract to constants
const UNHANDLED_COMMAND =
  'Sorry, something went wrong while handling that command. If this problem persists, please let my developer know!';
const UNKNOWN_ERROR = UNHANDLED_COMMAND;

async function readCommands(config: ResolvedAdaConfig): Promise<DiscoveredCommand[]> {
  console.log('readCommands');
  const { commandsDir } = config;
  const discoveredCommands = await walkDirectory(
    (body, filepath) => {
      console.log('Walking, at file', filepath);
      resetContext();
      const exports = runInContext(
        `${body};\nObject.keys(module.exports).length?module.exports:exports;`,
        commandHandlersContext,
        {
          filename: filepath,
        }
      );
      if (!exports) {
        console.error('no exports', { exports, filepath, body });
        return;
      }
      const { config = {}, default: defaultExport, handler: handlerExport } = exports;
      const handler = handlerExport || defaultExport;
      if (!handler) {
        console.error('Default export missing', filepath);
        return;
      }
      if (typeof handler !== 'function') {
        console.error('Default export is not a function', filepath);
        return;
      }
      if (!config.name) {
        // Fallback to the name of the command file
        config.name = basename(filepath, extname(filepath));
        if (config.name === 'index') {
          // If the filename is index, fallback to the name of the directory instead
          config.name = basename(dirname(filepath));
        }
      }
      return [handler, config] as DiscoveredCommand;
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

function patchClient(client: AdaClient, commands: DiscoveredCommand[]) {
  console.log('patchClient');
  const a = console.log({ commands });
  for (const command of commands) {
    const [handler, metadata] = command;
    const isGlobal = metadata.global === true;
    const commands = isGlobal ? client.globalCommands : client.guildCommands;
    commands.set(metadata.name, handler);
  }
  if (process.env.ADA_ENV === 'test') {
    Object.defineProperty(client, 'login', {
      value: async (token: string) => '',
      enumerable: true,
      configurable: true,
      writable: false,
    });
  }
}

function maybeRegisterCommands(
  client: AdaClient,
  commands: DiscoveredCommand[],
  config: AdaConfig
) {
  console.log('maybeRegisterCommands');
  if (config.autoRegisterCommands !== true) {
    return;
  }
  // TODO: Auto register the commands
}

function maybeErrorReply(
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
    if (interaction.deferred) {
      interaction.followUp(replyMessage);
    } else {
      interaction.reply(replyMessage);
    }
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
          handler();
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
        // This creates an typechecker error when there's an unhandled switch case
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

function setupClient(client: AdaClient, commands: DiscoveredCommand[]) {
  console.log('setupClient');
  patchClient(client, commands);
  addClientListeners(client);
}

export const createClient = async (config: ResolvedAdaConfig): Promise<AdaClient> => {
  console.log('createClient');
  const commands = await readCommands(config);
  console.log('constructClient');
  const client = constructClient(config.bot);
  setupClient(client, commands);
  maybeRegisterCommands(client, commands, config);
  console.log('finished createClient');
  return client;
};
