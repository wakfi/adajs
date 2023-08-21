import { build } from 'esbuild';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

console.log('Building ada');

build({
  entryPoints: ['index.ts'],
  bundle: true,
  minify: false,
  // sourcemap: 'inline',
  target: 'esnext',
  platform: 'node',
  tsconfig: resolve(__dirname, 'tsconfig.json'),
  outfile: resolve(__dirname, '../../dist/ada.js'),
  packages: 'external',
})
  .then(() => console.log('Completed ada build'))
  .catch((e) => {
    console.log('Failed to build ada');
    if (e) {
      console.error(e);
    }
    process.exit(1);
  });
