import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/app.mjs';

async function fixture(t, options = {}) {
  const { app, db } = await createApp(options);
  // A test-only route makes Express's resolved address observable without
  // adding an address-disclosure endpoint to the classroom API.
  app.get('/test-client-address', (req, res) => res.json({ ip: req.ip }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    await db.close();
  });
  return { app, base: `http://127.0.0.1:${server.address().port}` };
}

test('local default ignores an untrusted forwarded client address', async (t) => {
  const { app, base } = await fixture(t);
  assert.equal(app.get('trust proxy'), false);
  const response = await fetch(`${base}/test-client-address`, {
    headers: { 'x-forwarded-for': '198.51.100.10' },
  });
  assert.deepEqual(await response.json(), { ip: '127.0.0.1' });
});

test('one trusted Vercel hop keeps login limits separate for different client addresses', async (t) => {
  const { app, base } = await fixture(t, { trustProxy: 1 });
  assert.equal(app.get('trust proxy'), 1);
  const response = await fetch(`${base}/test-client-address`, {
    headers: { 'x-forwarded-for': '203.0.113.20, 198.51.100.10' },
  });
  // Only the nearest forwarded address is trusted, not arbitrary earlier hops.
  assert.deepEqual(await response.json(), { ip: '198.51.100.10' });
  async function invalidNickname(address) {
    const result = await fetch(`${base}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': address },
      body: JSON.stringify({ nickname: ' ' }),
    });
    await result.json();
    return result.status;
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    assert.equal(await invalidNickname('198.51.100.10'), 400);
  }
  assert.equal(await invalidNickname('198.51.100.10'), 429);
  assert.equal(await invalidNickname('198.51.100.11'), 400);
});
