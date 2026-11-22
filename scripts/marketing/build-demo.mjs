import { build } from 'vite';
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
await build({ configFile: fileURLToPath(new URL('../../vite.demo.config.mjs', import.meta.url)), mode: 'demo' });
// Local website previews serve public/, independently of the tracker build.
await mkdir(new URL('../../public/demo/', import.meta.url), { recursive: true });
await cp(new URL('../../site-dist/demo/', import.meta.url), new URL('../../public/demo/', import.meta.url), { recursive: true });
