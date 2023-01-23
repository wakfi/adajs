import { CommandConfig } from '@ada/types';
import { CommandInteraction } from 'discord.js';

export const config: CommandConfig = {
  description: 'Testing arguments 2',
  // options: Object.entries(ApplicationCommandOptionType)
  //   .filter(([, v]) => typeof v === 'number')
  //   .slice(2)
  //   .map(([name, type], i) => ({
  //     name: name.toLowerCase(),
  //     description: name,
  //     type: type as any,
  //     required: true,
  //   })),
  // options: [
  //   {
  //     name: 'role',
  //     description: 'role',
  //     type: ApplicationCommandOptionType.Role,
  //     required: true,
  //   },
  // ],
  options: [
    { name: 'string', description: 'String', type: 3, required: true },
    {
      name: 'integer',
      description: 'Integer',
      type: 4,
      required: true,
    },
    {
      name: 'boolean',
      description: 'Boolean',
      type: 5,
      required: true,
    },
    { name: 'user', description: 'User', type: 6, required: true },
    {
      name: 'channel',
      description: 'Channel',
      type: 7,
      required: true,
    },
    { name: 'role', description: 'Role', type: 8, required: true },
    {
      name: 'mentionable',
      description: 'Mentionable',
      type: 9,
      required: true,
    },
    { name: 'number', description: 'Number', type: 10, required: true },
    {
      name: 'attachment',
      description: 'Attachment',
      type: 11,
      required: true,
    },
  ],
};

type HandlerType = (args: { interaction: CommandInteraction }) => any;

export const handler: HandlerType = ({ interaction }) => {
  console.log(interaction.options.data);
};
