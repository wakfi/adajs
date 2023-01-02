import { Client, Collection } from 'discord.js';
import { InteractionOfCommand } from './client-loader';

export class AdaClient extends Client {
  public guildCommands: Collection<string, BasicCallable> = new Collection();
  public globalCommands: Collection<string, BasicCallable> = new Collection();

  public findCommand(interaction: InteractionOfCommand): Optional<BasicCallable> {
    const isGlobal = interaction.commandGuildId === null;
    const commands = isGlobal ? this.globalCommands : this.guildCommands;
    // TODO: Traverse options as needed
    const command = commands.get(interaction.commandName);
    return command;
  }
}
