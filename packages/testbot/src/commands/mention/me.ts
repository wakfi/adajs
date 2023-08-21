import type { CommandHandler } from '@ada/types';

const handler: CommandHandler = (interaction) => interaction.reply(`${interaction.user}`);

export default handler;
