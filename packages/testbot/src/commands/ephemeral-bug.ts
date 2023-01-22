import { CommandInteraction } from 'discord.js';

export const handler = (int: CommandInteraction) => {
  int.deferReply();
  throw new Error('oopsie');
};
