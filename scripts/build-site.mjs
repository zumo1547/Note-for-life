import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, '_site');
if (!destination.startsWith(`${root}${sep}`)) throw new Error('Invalid output path');
rmSync(destination, { recursive: true, force: true });
mkdirSync(resolve(destination, 'vendor/pdfjs'), { recursive: true });
const files = [
  'index.html', 'styles.css', 'import.css', 'app.js', 'pdf-reader.mjs',
  'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs'
];
for (const file of files) cpSync(resolve(root, file), resolve(destination, file));
writeFileSync(resolve(destination, '.nojekyll'), '');
console.log(`Built ${files.length} public files in ${destination}`);
