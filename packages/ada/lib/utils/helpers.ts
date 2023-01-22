import fg from 'fast-glob';
import { readFile } from 'fs/promises';

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
     * @default ['*.ts']
     */
    filter?: string[];
  }
) {
  console.log('walkDirectory');
  console.log('globbing on', { path, recursive, filter });
  const entries = await fg(
    filter.map((pattern) => {
      const prefixedIfNeeded = pattern.includes('/') ? pattern : `**/${pattern}`;
      const extensionUpdatedIfNeeded = prefixedIfNeeded.endsWith('.ts')
        ? `${prefixedIfNeeded.slice(0, -3)}.js`
        : prefixedIfNeeded;

      console.log(extensionUpdatedIfNeeded);
      return extensionUpdatedIfNeeded;
    }),
    {
      absolute: true,
      cwd: path,
      deep: recursive ? Infinity : 1,
    }
  );
  console.log('fast-glob entries', entries);
  const controller = new AbortController();
  const promises: Promise<Awaited<ReturnType<T>>>[] = entries.map(async (filepath) => {
    console.log('reading entry', filepath);
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
    console.log('awaiting callbacks');
    return await Promise.all(promises);
  } catch (e) {
    console.error(e);
    controller.abort();
    throw e;
  }
}
