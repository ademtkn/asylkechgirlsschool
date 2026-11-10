// Builds the site into ./docs (GitHub Pages serves main /docs).
// Usage: node src/build.mjs [--preview]   (--preview also writes docs/preview.html for the Claude artifact preview)
// The pages themselves come from src/site.mjs; the admin panel runs the same generator in the browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'docs');
const content = Object.fromEntries(['site', 'en', 'ky', 'ru', 'staff', 'news', 'pages']
  .map((f) => [f, JSON.parse(fs.readFileSync(path.join(ROOT, 'content', `${f}.json`), 'utf8'))]));
const out = generate({ content, exists: (p) => fs.existsSync(path.join(ROOT, p)), preview: process.argv.includes('--preview') });

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
fs.cpSync(path.join(ROOT, 'admin'), path.join(DIST, 'admin'), { recursive: true }); // the admin panel
fs.mkdirSync(path.join(DIST, 'admin', 'lib'), { recursive: true }); // generator copy for the panel
for (const f of ['site.mjs', 'icons.mjs']) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(DIST, 'admin', 'lib', f));
for (const [rel, text] of Object.entries(out)) {
  fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, rel), text);
}
console.log(`Built ${out.count} pages in 3 languages → docs/`);
