import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../server/app.mjs';

let instance, server, base, directory, alice, bob, post, firstComment;
const essay = [
  '우리 반 친구들과 함께 학교 텃밭에서 강낭콩을 기르고 있습니다. 처음에는 작은 씨앗에서 어떻게 커다란 잎이 나오는지 궁금했습니다.',
  '매일 아침 흙이 마르지 않았는지 살펴보고 필요한 만큼만 물을 주었습니다. 물을 너무 많이 주면 뿌리가 상할 수 있다는 사실도 배웠습니다.',
  '며칠 뒤에 초록색 새싹이 흙을 밀고 올라왔습니다. 친구들과 함께 새싹의 길이를 재고 관찰 공책에 날짜와 날씨를 자세하게 기록했습니다.',
  '어떤 화분은 햇빛이 잘 드는 창가에 두고 다른 화분은 조금 그늘진 곳에 두었습니다. 자라는 모습이 서로 달라서 햇빛의 중요성을 알 수 있었습니다.',
  '우리는 관찰한 내용을 사진과 글로 정리해서 학급 누리집에 올리기로 했습니다. 친구들이 언제든지 읽고 자신의 경험을 댓글로 나눌 수 있기 때문입니다.',
  '관찰 결과만 적기보다는 어려웠던 일과 해결한 방법도 함께 소개하면 좋겠습니다. 그래야 다음에 식물을 기르는 친구들에게 실제로 도움이 될 것입니다.',
  '물을 주는 일을 혼자 맡으면 잊어버릴 수 있으니 모둠 친구들이 돌아가면서 돌보는 방법을 제안합니다. 당번표를 만들어 교실 벽에 붙이면 누구나 쉽게 확인할 수 있습니다.',
  '나와 다른 생각을 가진 친구의 의견도 끝까지 듣고 싶습니다. 식물을 건강하게 기르는 방법을 함께 찾아가면 우리 반의 협력하는 마음도 자라날 것이라고 생각합니다.',
  '앞으로 꽃이 피고 열매가 맺히는 모습까지 꾸준히 관찰하겠습니다. 열매를 수확하는 날에는 모두가 노력한 과정을 돌아보며 가장 인상 깊었던 순간을 이야기하고 싶습니다.',
].join('\n\n');
const count = (value) => [...value.replace(/\s/gu, '')].length;
const validPost = (overrides = {}) => ({
  title: '친구들과함께기르는우리반강낭콩',
  content: essay,
  category: 'proud',
  revisionChecks: [true, true, true, true],
  ...overrides,
});
function mergeCookies(existing = '', headers) {
  const jar = new Map(existing.split('; ').filter(Boolean).map((entry) => entry.split('=')));
  for (const header of headers.getSetCookie()) {
    const [name, value] = header.split(';')[0].split('=');
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}
async function start() {
  instance = await createApp({ dataDir: join(directory, 'postgres'), production: true });
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
  return { status: response.status, headers: response.headers, data: response.status === 204 ? null : await response.json() };
}
async function login(nickname, cookie) {
  const response = await request('/session', { method: 'POST', cookie, body: { nickname } });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return mergeCookies(cookie, response.headers);
}
async function comment(cookie, content, parentId, postId = post.id) {
  return request(`/posts/${postId}/comments`, { method: 'POST', cookie, body: { content, ...(parentId ? { parentId } : {}) } });
}
const mission = (cookie) => request('/mission', { cookie });

before(async () => {
  assert.ok(count(essay) >= 200);
  directory = await mkdtemp(join(tmpdir(), 'nuri-api-'));
  await start();
});
after(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });

test('nickname-only entry starts a session while anonymous access and profane nicknames are rejected', async () => {
  assert.equal((await request('/health')).data.ok, true);
  assert.deepEqual((await request('/config')).data, { className: '탑텐반', entryMode: 'nickname' });
  for (const path of ['/posts', '/posts/unknown', '/session', '/mission']) assert.equal((await request(path)).status, 401);
  assert.equal((await request('/posts', { method: 'POST', body: validPost() })).status, 401);
  assert.equal((await request('/session', { method: 'POST', body: {} })).status, 400);
  for (const nickname of [' ', '씨발', '시발놈']) {
    assert.equal((await request('/session', { method: 'POST', body: { nickname } })).status, 400);
  }
  const response = await request('/session', { method: 'POST', body: { nickname: '초록새싹' } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /SameSite=Lax/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  alice = mergeCookies('', response.headers);
  bob = await login('노란별');
  assert.deepEqual((await mission(bob)).data, { count: 0, target: 3, completed: false, completedMissions: 0 });
});

test('the server enforces 10/200 non-whitespace characters and every revision check', async () => {
  const writer = await login('글쓰기연습');
  const compactEssay = essay.replace(/\s/gu, '');
  for (const overrides of [
    { title: '우리모두함께하는글'.slice(0, 9) },
    { title: '가 '.repeat(9) },
    { content: compactEssay.slice(0, 199) },
    { content: `${compactEssay.slice(0, 199)}${' \n\t'.repeat(100)}` },
    { revisionChecks: undefined },
    { revisionChecks: [true, true, true, false] },
    { revisionChecks: [true, true, true] },
    { revisionChecks: ['true', 'true', 'true', 'true'] },
    { category: 'invalid' },
  ]) {
    const result = await request('/posts', { method: 'POST', cookie: writer, body: validPost(overrides) });
    assert.equal(result.status, 400, JSON.stringify({ overrides, result: result.data }));
  }
  const boundary = validPost({ title: '우리모두함께읽는이야기'.slice(0, 10), content: compactEssay.slice(0, 200) });
  assert.equal(count(boundary.title), 10);
  assert.equal(count(boundary.content), 200);
  assert.equal((await request('/posts', { method: 'POST', cookie: writer, body: boundary })).status, 201);
  const spacedBoundary = { ...boundary, content: [...boundary.content].join(' \n\t') };
  assert.equal(count(spacedBoundary.content), 200);
  assert.equal((await request('/posts', { method: 'POST', cookie: writer, body: spacedBoundary })).status, 201);
});

test('validated posts and comments are shared with server-controlled authorship', async () => {
  const created = await request('/posts', { method: 'POST', cookie: alice, body: validPost({ author: '다른사람' }) });
  assert.equal(created.status, 201);
  post = created.data;
  assert.equal(post.author, '초록새싹');
  assert.equal(post.is_own, true);
  const response = await request(`/posts/${post.id}/comments`, {
    method: 'POST', cookie: bob,
    body: { content: '식물의 변화를 꾸준히 관찰하고 기록한 점이 정말 인상 깊었어요.', author: '위조별명' },
  });
  assert.equal(response.status, 201);
  firstComment = response.data;
  assert.equal(firstComment.author, '노란별');
  assert.equal(firstComment.parent_id, null);
  assert.equal(firstComment.mission.count, 1);
  const detail = await request(`/posts/${post.id}`, { cookie: bob });
  assert.equal(detail.data.is_own, false);
  assert.equal(detail.data.comment_count, 1);
  assert.equal(detail.data.comments[0].is_own, true);
  assert.equal(detail.data.comments[0].content, firstComment.content);
  const listing = await request('/posts', { cookie: bob });
  assert.equal(listing.data.posts.find((item) => item.id === post.id).comment_count, 1);
});

test('recommendations toggle once per student and persist in detail and list responses', async () => {
  const like = () => request(`/posts/${post.id}/like`, { method: 'POST', cookie: bob, body: {} });
  assert.deepEqual((await like()).data, { like_count: 1, liked: true });
  assert.deepEqual((await like()).data, { like_count: 0, liked: false });
  assert.deepEqual((await like()).data, { like_count: 1, liked: true });
  const detail = (await request(`/posts/${post.id}`, { cookie: alice })).data;
  assert.equal(detail.like_count, 1);
  assert.equal(detail.liked, false);
  const listing = (await request('/posts', { cookie: bob })).data;
  assert.equal(listing.posts.find((item) => item.id === post.id).liked, true);
  assert.equal((await request('/posts/missing/like', { method: 'POST', cookie: bob, body: {} })).status, 404);
});

test('replies attach only to a top-level comment on the same post and do not advance the mission', async () => {
  const reply = await comment(alice, '응원해 주어서 고마워요. 다음에는 꽃이 피는 모습도 함께 보여 줄게요.', firstComment.id);
  assert.equal(reply.status, 201);
  assert.equal(reply.data.parent_id, firstComment.id);
  const friendReply = await comment(bob, '좋아요. 꽃이 피는 시기와 열매가 맺히는 모습도 무척 궁금합니다.', firstComment.id);
  assert.equal(friendReply.status, 201);
  assert.equal(friendReply.data.mission.count, 1);
  assert.equal((await comment(bob, '친구들의 관찰 기록을 비교하면 더 다양한 사실을 배울 수 있겠어요.', reply.data.id)).status, 400);
  const another = await request('/posts', { method: 'POST', cookie: alice, body: validPost({ title: '우리반텃밭의새로운관찰이야기' }) });
  assert.equal(another.status, 201);
  assert.equal((await comment(bob, '함께 기록을 나누는 활동은 친구들의 생각을 이해하는 데 도움이 돼요.', firstComment.id, another.data.id)).status, 400);
  assert.equal((await comment(bob, '관찰한 내용을 사진과 함께 소개하면 다른 친구들도 이해하기 쉬워요.', 'missing')).status, 400);
});

test('empty, short, random, repetitive, and duplicate comments are rejected without mission credit', async () => {
  const reviewer = await login('푸른하늘');
  for (const content of [' ', '좋은 생각이에요.', 'ㅁㄴ로호'.repeat(8), 'ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ', '가나다라마바사'.repeat(7), '정말좋아요'.repeat(8), 'x'.repeat(501)]) {
    const result = await comment(reviewer, content);
    assert.equal(result.status, 400, JSON.stringify({ content, result: result.data }));
  }
  assert.equal((await mission(reviewer)).data.count, 0);
  assert.equal((await comment(bob, firstComment.content)).status, 409);
  assert.equal((await comment(bob, firstComment.content.replaceAll(' ', '  '))).status, 409);
  assert.equal((await mission(bob)).data.count, 1);
  const valid = '사진을 함께 보여 주면 친구들이 식물의 변화를 더욱 쉽게 이해할 수 있어요.';
  assert.equal((await comment(reviewer, valid)).status, 201);
  assert.equal((await mission(reviewer)).data.count, 1);
});

test('only three accepted comments on friends’ posts complete one mission', async () => {
  const ownPost = await request('/posts', { method: 'POST', cookie: bob, body: validPost({ title: '함께생각해보는즐거운식물관찰' }) });
  assert.equal(ownPost.status, 201);
  const ownComment = await comment(bob, '제 글을 읽어 주셔서 고마워요. 다음 관찰 기록도 꾸준히 남겨 보겠습니다.', undefined, ownPost.data.id);
  assert.equal(ownComment.status, 201);
  assert.equal(ownComment.data.mission.count, 1);
  assert.equal((await comment(bob, '물을 주는 순서를 정하면 친구들이 빠짐없이 참여할 수 있을 것 같아요.')).status, 201);
  assert.deepEqual((await mission(bob)).data, { count: 2, target: 3, completed: false, completedMissions: 0 });
  const third = await comment(bob, '햇빛이 드는 시간도 함께 기록하면 식물의 성장 차이를 설명하기 좋겠어요.');
  assert.equal(third.status, 201);
  assert.deepEqual(third.data.mission, { count: 3, target: 3, completed: true, completedMissions: 1 });
  const fourth = await comment(bob, '관찰 결과뿐 아니라 어려웠던 점을 소개한 부분에서 많은 도움을 받았어요.');
  assert.equal(fourth.status, 201);
  assert.deepEqual(fourth.data.mission, { count: 3, target: 3, completed: true, completedMissions: 1 });
});

test('search, category filters, and pagination return persisted stories', async () => {
  for (let i = 0; i < 10; i++) {
    assert.equal((await request('/posts', { method: 'POST', cookie: alice, body: validPost({ title: `친구에게추천하고싶은책이야기${i}`, category: 'book' }) })).status, 201);
  }
  const first = (await request('/posts', { cookie: alice })).data;
  assert.equal(first.posts.length, 9);
  assert.equal(first.total, 15);
  assert.equal(first.pages, 2);
  const second = (await request('/posts?page=2', { cookie: alice })).data;
  assert.equal(second.posts.length, 6);
  assert.equal(new Set([...first.posts, ...second.posts].map((item) => item.id)).size, 15);
  const search = (await request(`/posts?q=${encodeURIComponent(post.title)}`, { cookie: alice })).data;
  assert.equal(search.total, 1);
  assert.equal(search.posts[0].id, post.id);
  assert.equal((await request('/posts?category=book', { cookie: alice })).data.total, 10);
  assert.equal((await request(`/posts?q=${encodeURIComponent("' OR 1=1 --")}`, { cookie: alice })).data.total, 0);
  assert.equal((await request('/posts?category=unknown', { cookie: alice })).status, 400);
});

test('missing-post, oversized, and cross-origin requests fail safely', async () => {
  const visitor = await login('작은구름');
  assert.equal((await comment(visitor, '친구들이 서로 배려하며 함께 관찰하는 활동을 응원하고 싶습니다.', undefined, 'missing')).status, 404);
  assert.equal((await request('/posts/missing', { cookie: visitor })).status, 404);
  assert.equal((await request('/posts', { method: 'POST', cookie: visitor, body: validPost(), origin: 'https://unrelated.invalid' })).status, 403);
  assert.equal((await request('/posts', { method: 'POST', cookie: visitor, body: { content: 'x'.repeat(30000) } })).status, 413);
});

test('server restart preserves stories, replies, recommendations, sessions, and mission progress', async () => {
  await stop(); await start();
  const detail = await request(`/posts/${post.id}`, { cookie: bob });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.title, post.title);
  assert.equal(detail.data.comments.length, 7);
  assert.equal(detail.data.comments.filter((item) => item.parent_id).length, 2);
  assert.equal(detail.data.like_count, 1);
  assert.equal(detail.data.liked, true);
  assert.equal((await request('/posts', { cookie: alice })).data.total, 15);
  assert.equal((await mission(bob)).data.completedMissions, 1);
});

test('logout revokes the session while the same browser keeps its mission on re-entry', async () => {
  const previous = bob;
  const loggedOut = await request('/session', { method: 'DELETE', cookie: bob });
  assert.equal(loggedOut.status, 204);
  assert.equal((await request('/posts', { cookie: previous })).status, 401);
  bob = await login('노란별', mergeCookies(bob, loggedOut.headers));
  assert.deepEqual((await mission(bob)).data, { count: 3, target: 3, completed: true, completedMissions: 1 });
  assert.equal((await request(`/posts/${post.id}`, { cookie: bob })).data.liked, true);
});

test('a different nickname on the same device has separate mission and recommendation state', async () => {
  const otherStudent = await login('다른친구', bob);
  assert.deepEqual((await mission(otherStudent)).data, { count: 0, target: 3, completed: false, completedMissions: 0 });
  assert.equal((await request(`/posts/${post.id}`, { cookie: otherStudent })).data.liked, false);
  bob = await login('노란별', otherStudent);
  assert.equal((await mission(bob)).data.completedMissions, 1);
});



test('nickname-only upgrade preserves legacy code-era sessions, stories, and mission eligibility', async () => {
  const legacyPath = join(directory, 'legacy-postgres');
  const legacyDb = new PGlite(legacyPath);
  await legacyDb.waitReady;
  await legacyDb.exec(`
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, nickname TEXT NOT NULL, expires_at BIGINT NOT NULL, class_key TEXT NOT NULL);
    CREATE TABLE posts (id TEXT PRIMARY KEY, sequence BIGSERIAL UNIQUE, author TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE comments (id TEXT PRIMARY KEY, sequence BIGSERIAL UNIQUE, post_id TEXT NOT NULL REFERENCES posts(id), author TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  const token = randomBytes(32).toString('hex');
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  await legacyDb.query('INSERT INTO sessions VALUES ($1, $2, $3, $4)', [hash(token), '옛날친구', Date.now() + 60_000, hash('old-access-code-no-longer-required')]);
  await legacyDb.query('INSERT INTO posts (id, author, category, title, content, created_at) VALUES ($1, $2, $3, $4, $5, $6)', ['legacy-post', '옛날친구', 'daily', '기존의 짧은 글', '예전에 쓴 내용을 그대로 보존해요.', new Date().toISOString()]);
  await legacyDb.query('INSERT INTO comments (id, post_id, author, content, created_at) VALUES ($1, $2, $3, $4, $5)', ['legacy-comment', 'legacy-post', '옛날친구', '예전 댓글이에요.', new Date().toISOString()]);
  await legacyDb.close();
  const upgraded = await createApp({ dataDir: legacyPath, production: true });
  const legacyServer = upgraded.app.listen(0, '127.0.0.1');
  await once(legacyServer, 'listening');
  const legacyBase = `http://127.0.0.1:${legacyServer.address().port}/api`;
  const options = { headers: { cookie: `nuri_session=${token}` } };
  try {
    const session = await fetch(`${legacyBase}/session`, options);
    assert.equal(session.status, 200);
    assert.match(session.headers.get('set-cookie'), /nuri_student=/);
    assert.deepEqual(await session.json(), { nickname: '옛날친구' });
    const response = await fetch(`${legacyBase}/posts/legacy-post`, options);
    assert.equal(response.status, 200);
    const detail = await response.json();
    assert.equal(detail.title, '기존의 짧은 글');
    assert.equal(detail.content, '예전에 쓴 내용을 그대로 보존해요.');
    assert.equal(detail.is_own, true);
    assert.equal(detail.comments[0].content, '예전 댓글이에요.');
    assert.equal(detail.comments[0].parent_id, null);
    assert.equal(detail.like_count, 0);
    const progress = await fetch(`${legacyBase}/mission`, options);
    assert.deepEqual(await progress.json(), { count: 0, target: 3, completed: false, completedMissions: 0 });
  } finally {
    await new Promise((resolve) => { legacyServer.close(resolve); legacyServer.closeAllConnections(); });
    await upgraded.db.close();
  }
});
