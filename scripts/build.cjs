// The game uses ordered classic scripts and ships Phaser locally.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
if (path.dirname(out) !== root || path.basename(out) !== 'dist' ||
    (fs.existsSync(out) && fs.lstatSync(out).isSymbolicLink())) throw Error('Unsafe output directory');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const entry of ['index.html', 'main.js', 'manifest.json', 'privacy-policy.html',
  'user-agreement.html', 'assets', 'css', 'game', 'lib', 'scenes', 'sync', 'ui', 'utils']) {
  fs.cpSync(path.join(root, entry), path.join(out, entry), { recursive: true,
    filter: source => !source.endsWith('.bak') && source !== path.join(root, 'assets', 'old') });
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^(https?:|data:)/.test(match[1])) continue;
  if (!fs.existsSync(path.join(out, match[1]))) throw Error(`Missing resource: ${match[1]}`);
}
console.log(`Static build ready: ${out}`);
