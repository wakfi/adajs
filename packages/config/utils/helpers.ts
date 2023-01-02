import { readFileSync } from 'fs';
import { resolve } from 'path';
import { tryIgnore, tryParse } from 'shared/utils/helpers';

export const mainFilepath = (args = process.argv) => {
  const pathArg = args[1];
  const path = resolve(pathArg);
  return path;
};

export const importJson = <T = any>(path: string) => {
  const body = tryIgnore(readFileSync, path, { encoding: 'utf8' }) as string;
  if (body === undefined) return;
  return tryParse<T>(body);
};
