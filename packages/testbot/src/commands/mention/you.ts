import type { CommandInteraction } from 'discord.js';

export default (interaction: CommandInteraction) =>
  interaction.reply(`${interaction.client.user}`);
