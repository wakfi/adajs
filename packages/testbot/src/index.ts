import { createClient } from '@ada/index';
import { AdaClient } from '@ada/lib/core/client/AdaClient';
import { collectionToObject } from '@ada/lib/utils/helpers';
import { CommandsCollection } from '@ada/types';
import { Collection } from 'discord.js';
import { importJson } from 'shared/utils/fs-helpers';
import { tryIgnore } from 'shared/utils/helpers';

const env = importJson('.env');
Object.entries(env).map(([k, v]) => {
  globalThis[k] = v;
});

function auditCommands(commands: CommandsCollection, collectionName = '') {
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
      await tryIgnore(entry.handler, { reply: () => {} });
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function auditAllCommands(client: AdaClient) {
  console.log('auditCommands');
  console.log(
    'guild',
    client.guildCommands.size - 1,
    'global',
    client.globalCommands.size - 1
  );
  auditCommands(client.globalCommands, 'GLOBAL');
  auditCommands(client.guildCommands, 'GUILD');
}

async function main() {
  const client = await createClient();
  // eslint-disable-next-line @typescript-eslint/unbound-method
  console.log('calling login', client.login);
  await client.login(TOKEN);
  console.log('finished login');
  if (process.env.ADA_ENV === 'test') {
    // auditAllCommands(client);
    // console.log(client.globalCommands);
    console.log('globalCommands:', collectionToObject(client.globalCommands));
    console.log('guildCommands:', collectionToObject(client.guildCommands));
    !client.config.debug.hotReload && (await client.destroy());
  }
}
void main();
