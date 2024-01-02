import { MODULE_NAME } from '../utils/constants';

export function failedToLoadConfig(): never {
  throw new Error(`Failed to load: Missing ${MODULE_NAME}config`);
}
