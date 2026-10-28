import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'nuri-browser-'));
const child = spawn(process.execPath, ['server/index.mjs', '--production'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATA_DIR: directory,
    PORT: '3100',
    HOST: '127.0.0.1',
    DATABASE_URL: '',
    CLASS_CODE: 'browser-test-only',
    COOKIE_SECURE: 'false',
  },
});
let stopping = false;
function stop() {
  if (!stopping) {
    stopping = true;
    child.kill('SIGTERM');
  }
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', async (code) => {
  await rm(directory, { recursive: true, force: true });
  process.exit(code ?? 0);
});
