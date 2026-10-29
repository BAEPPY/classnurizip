export type Category = 'daily' | 'question' | 'book' | 'proud';
export type Post = {
  id: string;
  author: string;
  category: Category;
  title: string;
  content: string;
  created_at: string;
  comment_count: number;
  like_count: number;
  liked: boolean;
  is_own: boolean;
};
export type Comment = {
  id: string;
  post_id: string;
  parent_id: string | null;
  is_own: boolean;
  author: string;
  content: string;
  created_at: string;
};
export type PostDetail = Post & { comments: Comment[] };
export type PostList = {
  posts: Post[];
  total: number;
  page: number;
  pages: number;
  totals: { posts: number; comments: number };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('연결이 잠깐 끊겼어요. 인터넷 연결을 확인하고 다시 시도해 주세요.', 0);
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(body.error || '잠깐 문제가 생겼어요. 다시 시도해 주세요.', response.status);
  return body as T;
}

export const categories: { id: Category; label: string; emoji: string; prompt: string }[] = [
  { id: 'daily', label: '일상 이야기', emoji: '☀️', prompt: '오늘 어떤 일이 있었나요?' },
  { id: 'question', label: '궁금해요', emoji: '💡', prompt: '친구들과 함께 답을 찾아봐요.' },
  { id: 'book', label: '책 이야기', emoji: '📚', prompt: '친구에게 소개하고 싶은 책이 있나요?' },
  { id: 'proud', label: '자랑해요', emoji: '🌱', prompt: '작은 도전도 함께 축하해요.' },
];

export function dateLabel(value: string, full = false) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    ...(full ? { hour: 'numeric', minute: 'numeric' } : {}),
  }).format(new Date(value));
}

export type Mission = {
  count: number;
  target: number;
  completed: boolean;
  completedMissions: number;
};
export function characterCount(value: string) {
  return [...value.normalize('NFC').replace(/\s/gu, '')].length;
}
