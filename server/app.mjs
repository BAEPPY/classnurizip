import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { openDatabase } from './database.mjs';
import { commentError, commentKey, hasProfanity, normalizedText } from './validation.mjs';

const categories = new Set(['daily', 'question', 'book', 'proud']);
const hash = (value) => createHash('sha256').update(value).digest();
const sessionDuration = 7 * 24 * 60 * 60 * 1000;
const cookieName = 'nuri_session';
const studentCookieName = 'nuri_student';
const studentDuration = 365 * 24 * 60 * 60 * 1000;

function text(value, min, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= min &&
    trimmed.length <= max &&
    !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)
    ? trimmed
    : null;
}

function cookieToken(req, name = cookieName) {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie?.slice(name.length + 1) ?? '';
}

export async function createApp({
  dataDir,
  databaseUrl,
  classCode,
  className = '탑텐반',
  production = false,
  secureCookie = false,
  trustProxy = false,
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
  if (trustProxy) app.set('trust proxy', trustProxy);
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
  async function studentIdentity(req, nickname) {
    const previousToken = cookieToken(req, studentCookieName);
    const token = /^[a-f0-9]{64}$/u.test(previousToken)
      ? previousToken
      : randomBytes(32).toString('hex');
    const identityHash = hash(`${token}\0${nickname.normalize('NFKC').toLowerCase()}`).toString(
      'hex',
    );
    const [existing] = await db.query('SELECT id FROM students WHERE identity_hash = $1', [
      identityHash,
    ]);
    if (existing) return { id: existing.id, token };
    const id = randomUUID();
    const [student] = await db.query(
      `INSERT INTO students (id, identity_hash, created_at) VALUES ($1, $2, $3)
      ON CONFLICT (identity_hash) DO UPDATE SET identity_hash = EXCLUDED.identity_hash RETURNING id`,
      [id, identityHash, new Date().toISOString()],
    );
    return { id: student.id, token };
  }
  async function missionFor(studentId) {
    const [{ count }] = await db.query(
      'SELECT count(*)::int AS count FROM comments WHERE student_id = $1 AND mission_eligible = TRUE',
      [studentId],
    );
    return {
      count: Math.min(count, 3),
      target: 3,
      completed: count >= 3,
      completedMissions: count >= 3 ? 1 : 0,
    };
  }
  function serializePost(post, req) {
    const { student_id, ...publicPost } = post;
    return {
      ...publicPost,
      is_own: student_id ? student_id === req.studentId : post.author === req.nickname,
    };
  }
  function serializeComment(comment, req) {
    const { student_id, normalized_content, mission_eligible, ...publicComment } = comment;
    return {
      ...publicComment,
      is_own: student_id ? student_id === req.studentId : comment.author === req.nickname,
    };
  }
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
    const nickname = normalizedText(req.body?.nickname, 2, 12);
    const code = text(req.body?.classCode, 6, 128);
    if (!nickname || /[\r\n\t]/.test(nickname))
      return res.status(400).json({ error: '별명은 줄바꿈 없이 2~12글자로 적어 주세요.' });
    if (hasProfanity(nickname))
      return res
        .status(400)
        .json({ error: '욕설이나 친구에게 상처 주는 말이 없는 별명을 정해 주세요.' });
    if (!code || !timingSafeEqual(hash(code), hash(classCode.trim())))
      return res.status(401).json({ error: '학급 코드를 다시 확인해 주세요.' });
    const token = randomBytes(32).toString('hex');
    const tokenHash = hash(token).toString('hex');
    const student = await studentIdentity(req, nickname);
    await db.query('DELETE FROM sessions WHERE expires_at <= $1 OR token_hash = $2', [
      Date.now(),
      hash(cookieToken(req)).toString('hex'),
    ]);
    await db.query(
      'INSERT INTO sessions (token_hash, nickname, expires_at, class_key, student_id) VALUES ($1, $2, $3, $4, $5)',
      [tokenHash, nickname, Date.now() + sessionDuration, classKey, student.id],
    );
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionDuration });
    res.cookie(studentCookieName, student.token, { ...cookieOptions, maxAge: studentDuration });
    res.json({ nickname });
  });
  app.delete('/api/session', async (req, res) => {
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [
      hash(cookieToken(req)).toString('hex'),
    ]);
    res.clearCookie(cookieName, cookieOptions);
    res.status(204).end();
  });
  app.use('/api', async (req, res, next) => {
    const sessionHash = hash(cookieToken(req)).toString('hex');
    const [session] = await db.query(
      'SELECT nickname, student_id FROM sessions WHERE token_hash = $1 AND expires_at > $2 AND class_key = $3',
      [sessionHash, Date.now(), classKey],
    );
    if (!session) return res.status(401).json({ error: '학급 코드로 먼저 입장해 주세요.' });
    if (!session.student_id) {
      const student = await studentIdentity(req, session.nickname);
      // Preserve existing sessions when upgrading the classroom database.
      const [updated] = await db.query(
        'UPDATE sessions SET student_id = COALESCE(student_id, $1) WHERE token_hash = $2 RETURNING student_id',
        [student.id, sessionHash],
      );
      session.student_id = updated.student_id;
      if (session.student_id === student.id)
        res.cookie(studentCookieName, student.token, { ...cookieOptions, maxAge: studentDuration });
    }
    req.nickname = session.nickname;
    req.sessionHash = sessionHash;
    req.studentId = session.student_id;
    next();
  });
  app.get('/api/session', (req, res) => res.json({ nickname: req.nickname }));
  app.get('/api/mission', async (req, res) => res.json(await missionFor(req.studentId)));
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
      `SELECT posts.*, (SELECT count(*)::int FROM comments WHERE post_id = posts.id) AS comment_count,
      (SELECT count(*)::int FROM post_likes WHERE post_id = posts.id AND active = TRUE) AS like_count,
      EXISTS(SELECT 1 FROM post_likes WHERE post_id = posts.id AND student_id = $4 AND active = TRUE) AS liked
      FROM posts ${where} ORDER BY sequence DESC LIMIT 9 OFFSET $3`,
      [...params, (page - 1) * 9, req.studentId],
    );
    const [totals] = await db.query(
      'SELECT (SELECT count(*)::int FROM posts) AS posts, (SELECT count(*)::int FROM comments) AS comments',
    );
    res.json({
      posts: posts.map((post) => serializePost(post, req)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 9)),
      totals,
    });
  });
  app.post('/api/posts', writeLimit, async (req, res) => {
    const title = normalizedText(req.body?.title, 10, 80);
    const content = normalizedText(req.body?.content, 500, 3000);
    const category = req.body?.category;
    if (!title || !content || !categories.has(category))
      return res.status(400).json({
        error:
          '공백을 제외하고 제목은 10자 이상, 내용은 500자 이상 써 주세요. 제목은 전체 80자, 내용은 전체 3,000자 이내예요.',
      });
    if (
      !Array.isArray(req.body?.revisionChecks) ||
      req.body.revisionChecks.length !== 4 ||
      !req.body.revisionChecks.every((checked) => checked === true)
    )
      return res
        .status(400)
        .json({ error: '글을 다시 읽고 고쳐쓰기 항목 4개를 모두 확인해 주세요.' });
    if (hasProfanity(title) || hasProfanity(content))
      return res
        .status(400)
        .json({ error: '친구에게 상처 주는 말 대신 다정한 표현으로 고쳐 주세요.' });
    const post = {
      id: randomUUID(),
      author: req.nickname,
      category,
      title,
      content,
      created_at: new Date().toISOString(),
    };
    await db.query(
      'INSERT INTO posts (id, author, category, title, content, created_at, student_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        post.id,
        post.author,
        post.category,
        post.title,
        post.content,
        post.created_at,
        req.studentId,
      ],
    );
    res.status(201).json({ ...post, comment_count: 0, like_count: 0, liked: false, is_own: true });
  });
  app.get('/api/posts/:id', async (req, res) => {
    const [post] = await db.query(
      `SELECT posts.*,
      (SELECT count(*)::int FROM post_likes WHERE post_id = posts.id AND active = TRUE) AS like_count,
      EXISTS(SELECT 1 FROM post_likes WHERE post_id = posts.id AND student_id = $2 AND active = TRUE) AS liked
      FROM posts WHERE id = $1`,
      [req.params.id, req.studentId],
    );
    if (!post) return res.status(404).json({ error: '이 이야기를 찾을 수 없어요.' });
    const comments = await db.query('SELECT * FROM comments WHERE post_id = $1 ORDER BY sequence', [
      post.id,
    ]);
    res.json({
      ...serializePost(post, req),
      comment_count: comments.length,
      comments: comments.map((comment) => serializeComment(comment, req)),
    });
  });
  app.post('/api/posts/:id/like', writeLimit, async (req, res) => {
    if (!(await db.query('SELECT id FROM posts WHERE id = $1', [req.params.id])).length)
      return res.status(404).json({ error: '이 이야기를 찾을 수 없어요.' });
    const [like] = await db.query(
      `INSERT INTO post_likes (post_id, student_id, active) VALUES ($1, $2, TRUE)
      ON CONFLICT (post_id, student_id) DO UPDATE SET active = NOT post_likes.active RETURNING active`,
      [req.params.id, req.studentId],
    );
    const [{ count }] = await db.query(
      'SELECT count(*)::int AS count FROM post_likes WHERE post_id = $1 AND active = TRUE',
      [req.params.id],
    );
    res.json({ like_count: count, liked: like.active });
  });
  app.post('/api/posts/:id/comments', writeLimit, async (req, res) => {
    const content = normalizedText(req.body?.content, 20, 500);
    const error = commentError(content || '');
    if (error) return res.status(400).json({ error });
    const [post] = await db.query('SELECT id, author, student_id FROM posts WHERE id = $1', [
      req.params.id,
    ]);
    if (!post) return res.status(404).json({ error: '이 이야기를 찾을 수 없어요.' });
    const parentId = req.body?.parentId ?? null;
    if (parentId !== null) {
      if (typeof parentId !== 'string')
        return res.status(400).json({ error: '답글을 달 댓글을 확인해 주세요.' });
      const [parent] = await db.query('SELECT id, post_id, parent_id FROM comments WHERE id = $1', [
        parentId,
      ]);
      if (!parent || parent.post_id !== post.id || parent.parent_id !== null)
        return res.status(400).json({ error: '이 글의 댓글에만 답글을 달 수 있어요.' });
    }
    const comment = {
      id: randomUUID(),
      post_id: req.params.id,
      author: req.nickname,
      content,
      parent_id: parentId,
      created_at: new Date().toISOString(),
    };
    const ownPost = post.student_id
      ? post.student_id === req.studentId
      : post.author === req.nickname;
    const inserted = await db.query(
      `INSERT INTO comments (id, post_id, author, content, created_at, student_id, parent_id, normalized_content, mission_eligible)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING RETURNING id`,
      [
        comment.id,
        comment.post_id,
        comment.author,
        comment.content,
        comment.created_at,
        req.studentId,
        parentId,
        commentKey(content),
        !ownPost && parentId === null,
      ],
    );
    if (!inserted.length)
      return res.status(409).json({
        error: '이미 쓴 댓글과 같은 내용이에요. 친구 글을 읽고 새로운 생각을 적어 주세요.',
      });
    res.status(201).json({ ...comment, is_own: true, mission: await missionFor(req.studentId) });
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
