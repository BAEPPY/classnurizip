// This is a transparent, deterministic classroom filter, not a semantic AI judge.
// Count visible non-whitespace code points consistently with the writing form.
export const characterCount = (value) => [...value.normalize('NFC').replace(/\s/gu, '')].length;

export function normalizedText(value, min, max) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFC').trim();
  if (
    characterCount(normalized) < min ||
    [...normalized].length > max ||
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(
      normalized,
    )
  )
    return null;
  return normalized;
}

export function hasProfanity(value) {
  const compact = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
  return /(?:씨발|시발|씨빨|시빨|씨팔|시팔|쌍년|쌍놈|개새끼|개세끼|개색끼|개자식|좆|지랄|병신|ㅂㅅ|ㅅㅂ|ㅆㅂ|ᄇᄉ|ᄉᄇ|ᄊᄇ|엿먹|닥쳐|꺼져|fuck|shit|bitch|asshole)/iu.test(
    compact,
  );
}

export function commentKey(content) {
  return content
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function commentError(content) {
  if (!normalizedText(content, 20, 500))
    return '댓글은 공백을 제외하고 20자 이상, 전체 500자 이내로 적어 주세요.';
  if (hasProfanity(content)) return '친구에게 상처 주는 말 대신 다정한 표현으로 고쳐 주세요.';
  const compact = commentKey(content);
  const letters = [...compact];
  const jamo = (compact.match(/[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/gu) || [])
    .length;
  const keyboardNoise = /(?:qwerty|asdf|zxcv|ㅁㄴㅇㄹ|ᄆᄂᄋᄅ)/iu.test(compact);
  const repeated = /(.)\1{5,}/u.test(compact) || /^(.{1,16})\1{2,}$/u.test(compact);
  const mostCommon = Math.max(
    0,
    ...[...new Set(letters)].map((letter) => letters.filter((item) => item === letter).length),
  );
  if (
    compact.length < 12 ||
    jamo > 2 ||
    keyboardNoise ||
    repeated ||
    new Set(letters).size < 6 ||
    mostCommon / letters.length > 0.45
  )
    return '자음이나 같은 말을 반복하기보다 친구의 글에 대한 생각과 까닭을 문장으로 써 주세요.';
  // Reject unbroken keyboard strings while allowing natural Korean without spaces.
  if (/^[a-z\d]+$/iu.test(compact) && content.trim().split(/\s+/u).length < 4)
    return '친구가 이해할 수 있도록 생각과 까닭을 문장으로 써 주세요.';
  return null;
}
