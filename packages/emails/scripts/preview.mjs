import { resolve } from 'node:path';
import { buildPreviewSite } from '../dist/preview.js';

const outDir = resolve(process.argv[2] ?? '.preview');
const entries = await buildPreviewSite(outDir);

console.log(`${entries.length} aperçus générés dans ${outDir}`);
console.log(`Ouvrez ${resolve(outDir, 'index.html')}`);
