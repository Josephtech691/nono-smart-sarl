// Prépare le dossier « www » de l'application : le site clients déjà construit (frontend/dist/client) + la couche
// native (src/native.js, compilée en un seul fichier) injectée dans index.html. Le site lui-même n'est pas modifié.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(root, '../frontend/dist/client');
const www = path.join(root, 'www');
const apiUrl = (process.env.VITE_API_URL || '').trim();

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('Site clients introuvable : lancez d\'abord « npm run build:client » dans frontend/.');
  process.exit(1);
}
if (!/^https:\/\/.+\/api$/.test(apiUrl)) {
  console.error('VITE_API_URL doit valoir https://votre-api.vercel.app/api (https, terminée par /api). Reçu : "' + apiUrl + '"');
  process.exit(1);
}

fs.rmSync(www, { recursive: true, force: true });
fs.cpSync(dist, www, { recursive: true });

// Dans l'application, pas de service worker (le contenu est déjà dans l'application) ni de manifeste web.
fs.rmSync(path.join(www, 'sw.js'), { force: true });

await build({
  entryPoints: [path.join(root, 'src/native.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2019',
  outfile: path.join(www, 'native.js'),
  define: { __API_URL__: JSON.stringify(apiUrl) },
});

const indexPath = path.join(www, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace('</body>', '<script src="/native.js"></script></body>');
fs.writeFileSync(indexPath, html);

console.log('Dossier www prêt (API : ' + apiUrl + ').');
