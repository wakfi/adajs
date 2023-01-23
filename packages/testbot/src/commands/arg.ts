import { CommandConfig } from '@ada/types';

export const config: CommandConfig = {
  options: [
    {
      name: 'test',
      description: 'idk',
      type: 3,
    },
  ],
};

export const handler = () => {
  console.log('ARG HANDLER');
};
