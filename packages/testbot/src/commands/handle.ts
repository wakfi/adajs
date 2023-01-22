import { CommandInteraction } from 'discord.js';

let a = 5;
export const handler = (interaction: CommandInteraction) => {
  console.log('HANDLER', a, q, myObj.val);
  myObj.val = 20;
  console.log('HANDLER', a, q, myObj.val);
  interaction.reply('test');
};

var q = 'haha';

const myObj = {
  val: 6,
};

myObj.val = 7;
