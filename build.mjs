import { cp, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { build } from 'tsup';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const OUTDIR = resolve(__dirname, 'dist');

console.log('Building ada');

build({
  entry: ['src/index.ts'],
  bundle: true,
  minify: false,
  // sourcemap: 'inline',
  target: 'esnext',
  tsconfig: resolve(__dirname, 'tsconfig.json'),
  format: ['esm', 'cjs'],
  dts: true,
  skipNodeModulesBundle: true,
})
  .then(
    () => (
      console.log('Copying types'),
      cp(resolve(__dirname, 'types.d.ts'), resolve(OUTDIR, 'types.d.ts'))
    )
  )
  .then(
    () => (
      console.log('Copying static files'),
      Promise.all([
        writeFile(resolve(OUTDIR, 'index.d.ts'), "import './types';", { flag: 'a' }),
        writeFile(resolve(OUTDIR, 'index.d.mts'), "import './types';", { flag: 'a' }),
        cp(resolve(__dirname, 'package.json'), resolve(OUTDIR, 'package.json')),
        cp(resolve(__dirname, 'README.md'), resolve(OUTDIR, 'README.md')),
      ])
    )
  )
  .then(() => console.log('Completed ada build'))
  .catch((e) => {
    console.log('Failed to build ada');
    if (e) {
      console.error(e);
    }
    process.exit(1);
  });
