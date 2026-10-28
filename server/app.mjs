import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { openDatabase } from './database.mjs';

const categories = new Set(['daily', 'question', 'book', 'proud']);
const hash = (value) => createHash('sha256').update(value).digest();
const sessionDuration = 7 * 24 * 60 * 60 * 1000;
const cookieName = 'nuri_session';

function text(value, min, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= min &&
    trimmed.length <= max &&
    !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)
    ? trimmed
    : null;
}

function sessionToken(req) {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  return cookie?.slice(cookieName.length + 1) ?? '';
}

export async function createApp({
  dataDir,
  databaseUrl,
  classCode,
  className = '우리 반',
  production = false,
  secureCookie = false,
}) {
  if (
    typeof classCode !== 'string' ||
    classCode.trim().length < 6 ||
    classCode.trim().length > 128
  ) {
    throw new Error('CLASS_CODE must contain between 6 and 128 characters.');
  }
  const db = await openDatabase({ dataDir, databaseUrl });
  const classKey = hash(classCode.trim()).toString('hex');
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'"],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              upgradeInsecureRequests: null,
            },
          }
        : false,
      strictTransportSecurity: secureCookie,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          return res.status(403).json({ error: '이 사이트에서 다시 시도해 주세요.' });
      } catch {
        return res.status(403).json({ error: '올바른 요청이 아니에요.' });
      }
    }
    next();
  });
  app.use(express.json({ limit: '24kb' }));
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: secureCookie, path: '/' };
  const loginLimit = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: '입장 시도가 너무 많아요. 잠시 뒤 다시 시도해 주세요.' },
  });
  const writeLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.sessionHash,
    message: { error: '조금 천천히 이야기해 볼까요? 잠시 뒤 다시 올려 주세요.' },
  });

  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true });
  });
  app.get('/api/config', (_req, res) => res.json({ className }));
  app.post('/api/session', loginLimit, async (req, res) => {
    const nickname = text(req.body?.nickname, 2, 12);
    const code = text(req.body?.classCode, 6, 128);
    if (!nickname || /[\r\n\t]/.test(nickname))
      return res.status(400).json({ error: '별명은 줄바꿈 없이 2~12글자로 적어 주세요.' });
    if (!code || !timingSafeEqual(hash(code), hash(classCode.trim())))
      return res.status(401).json({ error: '학급 코드를 다시 확인해 주세요.' });
    const token = randomBytes(32).toString('hex');
    const tokenHash = hash(token).toString('hex');
    await db.query('DELETE FROM sessions WHERE expires_at <= $1 OR token_hash = $2', [
      Date.now(),
      hash(sessionToken(req)).toString('hex'),
    ]);
    await db.query(
      'INSERT INTO sessions (token_hash, nickname, expires_at, class_key) VALUES ($1, $2, $3, $4)',
      [tokenHash, nickname, Date.now() + sessionDuration, classKey],
    );
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionDuration });
    res.json({ nickname });
  });
  app.delete('/api/session', async (req, res) => {
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [
      hash(sessionToken(req)).toString('hex'),
    ]);
    res.clearCookie(cookieName, cookieOptions);
    res.status(204).end();
  });
  app.use('/api', async (req, res, next) => {
    const sessionHash = hash(sessionToken(req)).toString('hex');
    const [session] = await db.query(
      'SELECT nickname FROM sessions WHERE token_hash = $1 AND expires_at > $2 AND class_key = $3',
      [sessionHash, Date.now(), classKey],
    );
    if (!session) return res.status(401).json({ error: '학급 코드로 먼저 입장해 주세요.' });
    req.nickname = session.nickname;
    req.sessionHash = sessionHash;
    next();
  });
  app.get('/api/session', (req, res) => res.json({ nickname: req.nickname }));
  app.get('/api/posts', async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (category !== 'all' && !categories.has(category))
      return res.status(400).json({ error: '이야기 주제를 확인해 주세요.' });
    if (query.length > 100)
      return res.status(400).json({ error: '검색어는 100글자 이내로 적어 주세요.' });
    const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
    const where =
      "WHERE ($1 = 'all' OR category = $1) AND ($2 = '' OR strpos(lower(title || ' ' || content || ' ' || author), lower($2)) > 0)";
    const params = [category, query];
    const [{ count: total }] = await db.query(
      `SELECT count(*)::int AS count FROM posts ${where}`,
      params,
    );
    const posts = await db.query(
      `SELECT posts.*, (SELECT count(*)::int FROM comments WHERE post_id = posts.id) AS comment_count FROM posts ${where} ORDER BY sequence DESC LIMIT 9 OFFSET $3`,
      [...params, (page - 1) * 9],
    );
    const [totals] = await db.query(
      'SELECT (SELECT count(*)::int FROM posts) AS posts, (SELECT count(*)::int FROM comments) AS comments',
    );
    res.json({ posts, total, page, pages: Math.max(1, Math.ceil(total / 9)), totals });
  });
  app.post('/api/posts', writeLimit, async (req, res) => {
    const title = text(req.body?.title, 1, 80);
    const content = text(req.body?.content, 1, 3000);
    const category = req.body?.category;
    if (!title || !content || !categories.has(category))
      return res
        .status(400)
        .json({ error: '제목은 1~80글자, 내용은 1~3,000글자로 적고 주제를 골라 주세요.' });
    const post = {
      id: randomUUID(),
      author: req.nickname,
      category,
      title,
      content,
      created_at: new Date().toISOString(),
    };
    await db.query(
      'INSERT INTO posts (id, author, category, title, content, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [post.id, post.author, post.category, post.title, post.content, post.created_at],
    );
    res.status(201).json({ ...post, comment_count: 0 });
  });
  app.get('/api/posts/:id', async (req, res) => {
    const [post] = await db.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!post) return res.status(404).json({ error: '이 이야기를 찾을 수 없어요.' });
    const comments = await db.query('SELECT * FROM comments WHERE post_id = $1 ORDER BY sequence', [
      post.id,
    ]);
    res.json({ ...post, comment_count: comments.length, comments });
  });
  app.post('/api/posts/:id/comments', writeLimit, async (req, res) => {
    const content = text(req.body?.content, 1, 500);
    if (!content) return res.status(400).json({ error: '댓글은 1~500글자로 적어 주세요.' });
    if (!(await db.query('SELECT id FROM posts WHERE id = $1', [req.params.id])).length)
      return res.status(404).json({ error: '이 이야기를 찾을 수 없어요.' });
    const comment = {
      id: randomUUID(),
      post_id: req.params.id,
      author: req.nickname,
      content,
      created_at: new Date().toISOString(),
    };
    await db.query(
      'INSERT INTO comments (id, post_id, author, content, created_at) VALUES ($1, $2, $3, $4, $5)',
      [comment.id, comment.post_id, comment.author, comment.content, comment.created_at],
    );
    res.status(201).json(comment);
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: '요청한 내용을 찾을 수 없어요.' }));
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.too.large')
      return res.status(413).json({ error: '내용이 너무 길어요. 조금 줄여 주세요.' });
    if (err instanceof SyntaxError && err.status === 400)
      return res.status(400).json({ error: '입력 내용을 다시 확인해 주세요.' });
    console.error('Request failed:', err.name);
    res.status(500).json({ error: '잠깐 문제가 생겼어요. 다시 시도해 주세요.' });
  });
  return { app, db };
}
