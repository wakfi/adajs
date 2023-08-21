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

export const handler = (...args) => {
  console.log('ARG HANDLER', args);
};
