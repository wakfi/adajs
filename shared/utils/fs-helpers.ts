import { readFileSync } from 'fs';
import { tryIgnore, tryParse } from './helpers';

export const importJson = <T = any>(path: string) => {
  const body = tryIgnore(readFileSync, path, { encoding: 'utf8' }) as string;
  if (body === undefined) return;
  return tryParse<T>(body);
};
