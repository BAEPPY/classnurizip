import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createApp } from '../server/app.mjs';

let instance, server, base, directory, alice, bob, post;
const classCode = randomBytes(12).toString('hex');
async function start(code = classCode) {
  instance = await createApp({
    dataDir: join(directory, 'postgres'),
    classCode: code,
    production: true,
  });
  server = instance.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}
async function stop() {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
      server.closeAllConnections();
    });
    await instance.db.close();
  }
}
async function request(path, { method = 'GET', body, cookie, origin } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    headers: response.headers,
    data: response.status === 204 ? null : await response.json(),
  };
}
async function login(nickname) {
  const response = await request('/session', { method: 'POST', body: { nickname, classCode } });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'nuri-api-'));
  await start();
});
after(async () => {
  await stop();
  await rm(directory, { recursive: true, force: true });
});

test('class code is required to read or write classroom content', async () => {
  assert.equal((await request('/health')).data.ok, true);
  assert.deepEqual((await request('/config')).data, { className: '우리 반' });
  for (const path of ['/posts', '/posts/unknown', '/session'])
    assert.equal((await request(path)).status, 401);
  assert.equal((await request('/posts', { method: 'POST', body: { title: 'hello' } })).status, 401);
  assert.equal(
    (
      await request('/session', {
        method: 'POST',
        body: { nickname: '초록새싹', classCode: 'incorrect' },
      })
    ).status,
    401,
  );
  assert.equal(
    (await request('/session', { method: 'POST', body: { nickname: ' ', classCode } })).status,
    400,
  );
  const response = await request('/session', {
    method: 'POST',
    body: { nickname: '초록새싹', classCode },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /SameSite=Lax/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  alice = response.headers.get('set-cookie').split(';')[0];
  bob = await login('노란별');
});

test('posts and comments belong to the signed-in nickname and are shared between classmates', async () => {
  const created = await request('/posts', {
    method: 'POST',
    cookie: alice,
    body: {
      title: '오늘 심은 강낭콩',
      content: '새싹이 자랐어요!\n내일도 물을 줄 거예요.',
      category: 'proud',
      author: '다른사람',
    },
  });
  assert.equal(created.status, 201);
  post = created.data;
  assert.equal(post.author, '초록새싹');
  const comment = await request(`/posts/${post.id}/comments`, {
    method: 'POST',
    cookie: bob,
    body: { content: '정말 멋져! 나도 보여 줘.', author: '위조별명' },
  });
  assert.equal(comment.status, 201);
  assert.equal(comment.data.author, '노란별');
  const detail = await request(`/posts/${post.id}`, { cookie: alice });
  assert.equal(detail.data.comments[0].content, '정말 멋져! 나도 보여 줘.');
  assert.equal(detail.data.comment_count, 1);
  const listing = await request('/posts', { cookie: bob });
  assert.equal(listing.data.posts[0].comment_count, 1);
  assert.deepEqual(listing.data.totals, { posts: 1, comments: 1 });
});

test('search, category filters, and pagination return the matching persisted stories', async () => {
  for (let i = 0; i < 10; i++) {
    assert.equal(
      (
        await request('/posts', {
          method: 'POST',
          cookie: alice,
          body: { title: `책 추천 ${i}`, content: '도서관에서 고른 책이에요.', category: 'book' },
        })
      ).status,
      201,
    );
  }
  const first = (await request('/posts', { cookie: bob })).data;
  assert.equal(first.posts.length, 9);
  assert.equal(first.total, 11);
  assert.equal(first.pages, 2);
  const second = (await request('/posts?page=2', { cookie: bob })).data;
  assert.equal(second.posts.length, 2);
  assert.equal(new Set([...first.posts, ...second.posts].map((item) => item.id)).size, 11);
  const search = (await request(`/posts?q=${encodeURIComponent('강낭콩')}`, { cookie: bob })).data;
  assert.equal(search.total, 1);
  assert.equal(search.posts[0].id, post.id);
  assert.equal((await request('/posts?category=book', { cookie: bob })).data.total, 10);
  assert.equal(
    (await request(`/posts?q=${encodeURIComponent("' OR 1=1 --")}`, { cookie: bob })).data.total,
    0,
  );
  assert.equal((await request('/posts?category=unknown', { cookie: bob })).status, 400);
});

test('invalid, oversized, missing-post, and cross-origin writes are rejected', async () => {
  for (const body of [
    { title: ' ', content: '내용', category: 'daily' },
    { title: '제목', content: ' ', category: 'daily' },
    { title: '제목', content: '내용', category: 'invalid' },
  ]) {
    assert.equal((await request('/posts', { method: 'POST', cookie: bob, body })).status, 400);
  }
  assert.equal(
    (
      await request(`/posts/${post.id}/comments`, {
        method: 'POST',
        cookie: bob,
        body: { content: 'x'.repeat(501) },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/posts/missing/comments', {
        method: 'POST',
        cookie: bob,
        body: { content: '안녕' },
      })
    ).status,
    404,
  );
  assert.equal((await request('/posts/missing', { cookie: alice })).status, 404);
  assert.equal(
    (
      await request('/posts', {
        method: 'POST',
        cookie: bob,
        body: { title: '제목', content: '내용', category: 'daily' },
        origin: 'https://unrelated.invalid',
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('/posts', { method: 'POST', cookie: bob, body: { content: 'x'.repeat(30000) } }))
      .status,
    413,
  );
});

test('logout invalidates the old session on the server', async () => {
  assert.equal((await request('/session', { method: 'DELETE', cookie: bob })).status, 204);
  assert.equal((await request('/posts', { cookie: bob })).status, 401);
});

test('posts, comments, and sessions survive a complete database/server restart', async () => {
  await stop();
  await start();
  const detail = await request(`/posts/${post.id}`, { cookie: alice });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.title, '오늘 심은 강낭콩');
  assert.equal(detail.data.comments.length, 1);
  assert.equal((await request('/posts', { cookie: alice })).data.total, 11);
});

test('changing the class code revokes existing sessions', async () => {
  await stop();
  await start(randomBytes(12).toString('hex'));
  assert.equal((await request('/posts', { cookie: alice })).status, 401);
});
