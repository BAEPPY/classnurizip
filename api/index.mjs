import { createApp } from '../server/app.mjs';

let instance;

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL || !process.env.CLASS_CODE?.trim()) {
    return res
      .status(503)
      .json({ error: '선생님이 이야기방을 준비하고 있어요. 잠시 후 다시 와 주세요.' });
  }
  try {
    instance ??= createApp({
      databaseUrl: process.env.DATABASE_URL,
      classCode: process.env.CLASS_CODE,
      className: process.env.CLASS_NAME || '우리 반',
      production: true,
      secureCookie: true,
    });
    const { app } = await instance;
    return app(req, res);
  } catch (error) {
    instance = undefined;
    console.error('Classroom startup failed:', error.name);
    return res
      .status(503)
      .json({ error: '이야기방에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
}
