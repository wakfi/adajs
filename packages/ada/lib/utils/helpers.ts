import fg from 'fast-glob';
import { readFile } from 'fs/promises';

export async function walkDirectory<
  T extends (body: string, filepath: string) => Awaitable<any>
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
  const entries = await fg(
    filter.map((pattern) => (pattern.includes('/') ? pattern : `**/${pattern}`)),
    {
      absolute: true,
      cwd: path,
      deep: recursive ? Infinity : 1,
    }
  );
  const controller = new AbortController();
  const promises: Promise<Awaited<ReturnType<T>>>[] = entries.map(async (filepath) => {
    const body = await readFile(filepath, {
      encoding: 'utf8',
      signal: controller.signal,
    });
    if (controller.signal.aborted) {
      return;
    }
    return await callback(body, filepath);
  });
  try {
    return await Promise.all(promises);
  } catch (e) {
    controller.abort();
    throw e;
  }
}
