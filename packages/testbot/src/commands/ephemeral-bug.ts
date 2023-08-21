import { CommandInteraction } from 'discord.js';

export const handler = (int: CommandInteraction) => {
  void int.deferReply();
  throw new Error('oopsie');
};
