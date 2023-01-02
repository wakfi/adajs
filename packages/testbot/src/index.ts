import { makeClient } from '@ada/index';
import { AdaClient } from '@ada/lib/core/client/factory/AdaClient';
import { importJson } from '@config/utils/helpers';

const env = importJson('.env');
Object.entries(env).map(([k, v]) => {
  globalThis[k] = v;
});
function auditCommands(client: AdaClient) {
  console.log('auditCommands');
  console.log('guild', client.guildCommands.size, 'global', client.globalCommands.size);
  client.guildCommands.map((_, key) => {
    console.log(`[GUILD COMMAND] ${key}`);
  });
  client.globalCommands.map((_, key) => {
    console.log(`[GLOBAL COMMAND] ${key}`);
  });
  client.guildCommands.map(async (handler, key) => {
    console.log(`[GUILD COMMAND] Running: ${key}`);
    await handler();
  });
  client.globalCommands.map(async (handler, key) => {
    console.log(`[GLOBAL COMMAND] Running: ${key}`);
    await handler();
  });
}

async function main() {
  const client = await makeClient();
  console.log('calling login', client.login);
  await client.login(TOKEN);
  console.log('finished login');
  auditCommands(client);
}
main();
