import { CommandInteraction } from 'discord.js';

// eslint-disable-next-line prefer-const
let a = 5;
export const handler = (interaction: CommandInteraction) => {
  console.log('HANDLER', a, q, myObj.val);
  myObj.val = 20;
  console.log('HANDLER', a, q, myObj.val);
  void interaction.reply('test');
};

// eslint-disable-next-line no-var
var q = 'haha';

const myObj = {
  val: 6,
};

myObj.val = 7;
