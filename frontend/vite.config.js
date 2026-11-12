import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Trois applications à partir du même code :
//   APP=client  -> client.html  -> dist/client   (clients)
//   APP=driver  -> driver.html  -> dist/driver   (livreurs)
//   APP=admin   -> admin.html   -> dist/admin    (administration)
//   (sans APP)  -> index.html   -> dist          (site complet, usage courant en développement)
const root = path.dirname(fileURLToPath(import.meta.url));
const APP = process.env.APP || '';
const HTML = { client: 'client.html', driver: 'driver.html', admin: 'admin.html' };
const PORTS = { client: 5173, admin: 5174, driver: 5175 };

if (APP && !HTML[APP]) {
  throw new Error(`APP="${APP}" inconnu : utilisez client, driver ou admin.`);
}

// Pour une application séparée : sert sa page HTML sur toutes les adresses (développement) et la
// renomme index.html dans le dossier de sortie (hébergement).
function standaloneApp(app) {
  let outDir = 'dist';
  return {
    name: 'standalone-app',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = (req.url || '').split('?')[0];
        const wantsHtml = (req.headers.accept || '').includes('text/html');
        if (wantsHtml && !url.includes('.') && !url.startsWith('/@') && !url.startsWith('/__')) {
          req.url = `/${HTML[app]}`;
        }
        next();
      });
    },
    closeBundle() {
      const from = path.join(outDir, HTML[app]);
      if (fs.existsSync(from)) fs.renameSync(from, path.join(outDir, 'index.html'));
    },
  };
}

export default defineConfig({
  plugins: [react(), ...(APP ? [standaloneApp(APP)] : [])],
  server: {
    port: PORTS[APP] || 5173,
  },
  build: {
    outDir: APP ? `dist/${APP}` : 'dist',
    emptyOutDir: true,
    rollupOptions: APP ? { input: path.join(root, HTML[APP]) } : undefined,
  },
});
