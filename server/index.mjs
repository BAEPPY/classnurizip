import express from 'express';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createApp } from './app.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(process.env.DATA_DIR || resolve(root, '.data'));
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
let classCode = process.env.CLASS_CODE?.trim();
if (!classCode) {
  const codePath = resolve(dataDir, 'class-code.txt');
  if (!existsSync(codePath)) {
    writeFileSync(codePath, randomBytes(6).toString('hex').toUpperCase() + '\n', {
      mode: 0o600,
      flag: 'wx',
    });
  }
  classCode = readFileSync(codePath, 'utf8').trim();
  console.log(`Class code is stored in ${codePath}. Share it with your class only.`);
}
const production = process.argv.includes('--production');
const { app, db } = await createApp({
  dataDir: resolve(dataDir, 'postgres'),
  databaseUrl: process.env.DATABASE_URL,
  classCode,
  className: process.env.CLASS_NAME || '우리 반',
  production,
  secureCookie: process.env.COOKIE_SECURE === 'true',
});
const server = createServer(app);
let vite;
if (production) {
  const index = resolve(root, 'dist/index.html');
  if (!existsSync(index)) throw new Error('Run npm run build before npm start.');
  app.use(express.static(resolve(root, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(index));
} else {
  const { createServer: createViteServer } = await import('vite');
  vite = await createViteServer({
    root,
    configLoader: 'native',
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () =>
  console.log(
    `Classnurizip ${production ? 'production' : 'development'} server listening on port ${port}.`,
  ),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  const timer = setTimeout(() => process.exit(1), 5000).unref();
  await vite?.close();
  server.close(async () => {
    await db.close();
    clearTimeout(timer);
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
