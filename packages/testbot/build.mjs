import { build } from 'esbuild';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

console.log('Building testbot');

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: false,
  // sourcemap: 'inline',
  target: 'esnext',
  platform: 'node',
  tsconfig: resolve(__dirname, 'tsconfig.json'),
  outfile: resolve(__dirname, '../../dist/testbot.js'),
  packages: 'external',
})
  .then(() => console.log('Completed testbot build'))
  .catch((e) => {
    console.log('Failed to build testbot');
    if (e) {
      console.error(e);
    }
    process.exit(1);
  });
