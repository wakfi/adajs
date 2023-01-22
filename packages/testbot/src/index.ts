import { createClient } from '@ada/index';
import { AdaClient } from '@ada/lib/core/client/AdaClient';
import { CommandsCollection } from '@ada/types';
import { importJson } from '@config/utils/helpers';
import { Collection } from 'discord.js';

const env = importJson('.env');
Object.entries(env).map(([k, v]) => {
  globalThis[k] = v;
});

function auditCommands(commands: CommandsCollection, collectionName: string = '') {
  const label = `${collectionName.toUpperCase()} COMMAND`.trim();
  commands.map((_, key) => {
    if (typeof key === 'symbol') return;
    console.log(`[${label}] ${key}`);
  });
  commands.map(async (entry, key) => {
    if (typeof key === 'symbol') return;
    console.log(`[${label}] Running: ${key}`);
    if (entry instanceof Collection) {
      console.warn('(is collection)');
      auditCommands(entry, `${collectionName.toUpperCase()} ${key}`.trim());
    } else {
      await entry.handler({ reply: () => {} });
    }
  });
}

function auditAllCommands(client: AdaClient) {
  console.log('auditCommands');
  console.log('guild', client.guildCommands.size, 'global', client.globalCommands.size);
  auditCommands(client.globalCommands, 'GLOBAL');
  auditCommands(client.guildCommands, 'GUILD');
}

async function main() {
  const client = await createClient();
  console.log('calling login', client.login);
  await client.login(TOKEN);
  console.log('finished login');
  if (process.env.ADA_ENV === 'test') {
    auditAllCommands(client);
  }
}
main();
