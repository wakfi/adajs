import { createLogger } from '@ada/lib/utils/logging';
import fg from 'fast-glob';
import { readFile } from 'fs/promises';
import { Collection } from '@discordjs/collection';

const DEBUG = process.env.ADA_DEBUG_FS === 'true' || process.env.ADA_DEBUG_FS === '1';
const logger = createLogger(() => DEBUG, { label: 'fs' });

export async function walkDirectory<
  T extends ({ body, filepath }: { body: string; filepath: string }) => Awaitable<any>
>(
  callback: T,
  {
    path,
    recursive,
    filter = ['*.ts'],
  }: {
    path: string;
    recursive?: boolean;
    /**
     * @default
     * ['*.ts']
     */
    filter?: string[];
  }
) {
  logger.log('walkDirectory');
  logger.log('globbing on', { path, recursive, filter });
  const entries = await fg(
    filter.map((pattern) => {
      const prefixedIfNeeded = pattern.includes('/') ? pattern : `**/${pattern}`;
      logger.log(prefixedIfNeeded);
      return prefixedIfNeeded;
    }),
    {
      absolute: true,
      cwd: path,
      deep: recursive ? Infinity : 1,
    }
  );
  logger.log('fast-glob entries', entries);
  const controller = new AbortController();
  const promises: Promise<Awaited<ReturnType<T>>>[] = entries.map(async (filepath) => {
    logger.log('reading entry', filepath);
    const body = await readFile(filepath, {
      encoding: 'utf8',
      signal: controller.signal,
    });
    if (controller.signal.aborted) {
      return;
    }
    return await callback({ body, filepath });
  });
  try {
    logger.log('awaiting callbacks');
    return await Promise.all(promises);
  } catch (e) {
    logger.error(e);
    controller.abort();
    throw e;
  }
}

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
