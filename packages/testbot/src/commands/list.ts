import { Collection } from '@discordjs/collection';

type CollectionToRecord<T extends Collection<any, any>> = T extends Collection<
  infer K,
  infer V
>
  ? Record<K & PropertyKey, V extends Collection<any, any> ? CollectionToRecord<V> : V>
  : never;

export const collectionToObject = <T extends Collection<any, any>>(
  collection: T
): CollectionToRecord<T> => {
  const obj: CollectionToRecord<T> = {} as any;
  for (const [key, value] of collection.entries()) {
    if (value instanceof Collection) {
      // @ts-expect-error
      obj[key] = collectionToObject(value);
    } else {
      // @ts-expect-error
      obj[key] = value;
    }
  }
  return obj;
};

const stringify = (data: unknown) =>
  JSON.stringify(
    data,
    (k, v) => {
      if (typeof v === 'bigint') {
        return `${v}`;
      }
      return v;
    },
    2
  );

export const config = {
  description: 'List all commands',
  global: true,
};

const chunk = (str: string) => {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += 1989) {
    chunks.push(str.slice(i, i + 1989));
  }
  return chunks;
};

export default async (interaction, client) => {
  await interaction.reply(stringify(collectionToObject(client.guildCommands)));
  const chunks = chunk(stringify(collectionToObject(client.globalCommands)));
  for (const chunk of chunks) {
    await interaction.followUp('```json\n' + chunk + '```');
  }
};
