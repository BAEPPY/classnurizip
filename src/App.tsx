import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  Flower2,
  Heart,
  LayoutGrid,
  LogOut,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Sprout,
  Sun,
  Users,
  X,
} from 'lucide-react';
import SchoolIllustration from './SchoolIllustration';
import {
  api,
  ApiError,
  categories,
  dateLabel,
  type Category,
  type Comment,
  type Post,
  type PostDetail,
  type PostList,
  type Mission,
  characterCount,
} from './api';

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'compact' : ''}`}>
      <span className="brand-mark">
        <BookOpen size={23} strokeWidth={2} />
      </span>
      <span>
        탑텐반 학급누리집<span className="brand-caption">작은 이야기, 함께 자라는 우리</span>
      </span>
    </div>
  );
}

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const tone = [...name].reduce((sum, c) => sum + c.codePointAt(0)!, 0) % 4;
  return (
    <span aria-hidden="true" className={`avatar tone-${tone} ${small ? 'small' : ''}`}>
      {[...name][0]}
    </span>
  );
}

function Illustration() {
  return <SchoolIllustration />;
}

const revisionQuestions = [
  '매체의 특성을 고려해 글을 썼나요?',
  '글을 쓰는 목적에 알맞은 매체를 골랐나요?',
  '읽는 친구를 생각하며 내용과 표현을 다듬었나요?',
  '맞춤법과 띄어쓰기를 확인했나요?',
];

function Login({ className, onLogin }: { className: string; onLogin: (name: string) => void }) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const session = await api<{ nickname: string }>('/session', {
        method: 'POST',
        body: JSON.stringify({ nickname }),
      });
      onLogin(session.nickname);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <header className="login-header">
        <Brand />
        <span className="small-label">
          <Sprout size={16} /> 함께 자라는 우리 반
        </span>
      </header>
      <main className="login-main">
        <section className="login-story">
          <span className="eyebrow">
            <span className="tiny-sun">✦</span> 우리만의 작은 이야기 정원
          </span>
          <h1>
            너의 이야기가
            <br />
            우리의 <span>하루가 돼.</span>
          </h1>
          <p>
            오늘 있었던 일, 문득 떠오른 궁금증.
            <br />
            친구들과 나누면 더 특별해질 거예요.
          </p>
          <Illustration />
          <div className="login-values">
            <span>
              <Pencil size={17} /> 나의 생각을 쓰고
            </span>
            <span>
              <MessageCircle size={17} /> 다정하게 답하고
            </span>
            <span>
              <Sprout size={17} /> 함께 자라요
            </span>
          </div>
        </section>
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-icon">
            <Users size={25} />
          </div>
          <span className="eyebrow">HELLO, FRIEND!</span>
          <h2 id="login-title">{className}에 놀러 왔나요?</h2>
          <p>나만의 닉네임을 정하고 바로 들어와요.</p>
          <form onSubmit={submit}>
            <label htmlFor="nickname">친구들이 불러 줄 별명</label>
            <input
              id="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="예: 초록새싹"
              autoComplete="off"
              minLength={2}
              maxLength={12}
              required
            />
            <span className="field-hint">
              이름 대신 나만의 닉네임을 정해요. 욕설은 사용할 수 없어요. (2~12글자)
            </span>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary login-submit" disabled={busy}>
              {busy ? '문을 여는 중…' : '우리 반 들어가기'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-note">
            <Heart size={18} />
            <span>
              서로의 생각을 존중하며
              <br />
              다정한 이야기를 나눠요.
            </span>
          </div>
        </section>
      </main>
      <footer className="login-footer">
        서로 다른 생각이 만나, 더 멋진 우리가 되는 곳. <Flower2 size={16} />
      </footer>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    document.body.classList.add('modal-open');
    return () => {
      dialog.close();
      document.body.classList.remove('modal-open');
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const focusable = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ),
        ];
        const first = focusable[0],
          last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <span>{title}</span>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function Composer({
  nickname,
  initialCategory,
  onClose,
  onCreated,
  onError,
}: {
  nickname: string;
  initialCategory: Category;
  onClose: () => void;
  onCreated: (post: Post) => void;
  onError: (err: unknown) => void;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [checks, setChecks] = useState([false, false, false, false]);
  const titleCount = characterCount(title),
    contentCount = characterCount(content);
  const valid = titleCount >= 10 && contentCount >= 500;
  function review(event: FormEvent) {
    event.preventDefault();
    if (!valid) {
      setError('제목은 10자 이상, 내용은 500자 이상 써 주세요. (공백 제외)');
      return;
    }
    setError('');
    setChecks([false, false, false, false]);
    setReviewing(true);
  }
  async function publish() {
    if (busy || !checks.every(Boolean) || !valid) return;
    setBusy(true);
    setError('');
    try {
      onCreated(
        await api<Post>('/posts', {
          method: 'POST',
          body: JSON.stringify({ category, title, content, revisionChecks: checks }),
        }),
      );
    } catch (err) {
      setError((err as Error).message);
      onError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={reviewing ? '스스로 고쳐쓰기' : '새 이야기 쓰기'}
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      {reviewing ? (
        <div className="compose-form review-form">
          <div className="review-intro">
            <span className="review-icon">
              <Pencil size={28} />
            </span>
            <h2>잠깐! 내 글을 다시 읽어 볼까요?</h2>
            <p>글을 올리기 전, 하나씩 살펴보고 스스로 체크해요.</p>
          </div>
          <details className="review-preview">
            <summary>내가 쓴 글 다시 읽기</summary>
            <h3>{title}</h3>
            <p className="story-content">{content}</p>
          </details>
          <div className="review-checks">
            {revisionQuestions.map((question, i) => (
              <label className={`review-check ${checks[i] ? 'checked' : ''}`} key={question}>
                <input
                  type="checkbox"
                  checked={checks[i]}
                  disabled={busy}
                  onChange={(event) =>
                    setChecks((current) =>
                      current.map((value, j) => (j === i ? event.target.checked : value)),
                    )
                  }
                />
                <span>{question}</span>
              </label>
            ))}
          </div>
          <p className="kind-note">
            <Check size={16} /> {checks.filter(Boolean).length} / 4 확인했어요. 모두 체크하면 게시할
            수 있어요.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="form-actions review-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setReviewing(false);
                setError('');
              }}
            >
              <ArrowLeft size={16} />
              돌아가서 고치기
            </button>
            <button
              type="button"
              className="button primary"
              disabled={busy || !checks.every(Boolean)}
              onClick={() => void publish()}
            >
              <Send size={16} />
              {busy ? '올리는 중…' : '확인하고 게시하기'}
            </button>
          </div>
        </div>
      ) : (
        <form className="compose-form" onSubmit={review}>
          <div className="author-line">
            <Avatar name={nickname} />
            <div>
              <strong>{nickname}</strong>
              <span>나의 생각을 차근차근 담아 봐요.</span>
            </div>
          </div>
          <div className="writing-guide">
            <Pencil size={17} />
            <span>
              제목 <b>10자 이상</b> · 내용 <b>500자 이상</b> · 공백 제외
            </span>
          </div>
          <fieldset className="category-picker">
            <legend>이야기 주제</legend>
            {categories.map((item) => (
              <label key={item.id} className={category === item.id ? 'selected' : ''}>
                <input
                  type="radio"
                  name="category"
                  value={item.id}
                  checked={category === item.id}
                  onChange={() => setCategory(item.id)}
                />
                <span>
                  {item.emoji} {item.label}
                </span>
              </label>
            ))}
          </fieldset>
          <label htmlFor="post-title">제목</label>
          <input
            id="post-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="어떤 이야기인가요? 10자 이상으로 적어 주세요."
            maxLength={80}
            required
            aria-describedby="title-count"
          />
          <span id="title-count" className={`field-counter ${titleCount >= 10 ? 'valid' : ''}`}>
            {titleCount}자 / 최소 10자 {titleCount >= 10 ? '✓' : `· ${10 - titleCount}자 더 써요`}
          </span>
          <label htmlFor="post-content">나의 이야기</label>
          <textarea
            id="post-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              categories.find((item) => item.id === category)!.prompt +
              '\n내 생각과 그 까닭, 구체적인 예를 함께 써 보세요.'
            }
            maxLength={3000}
            rows={10}
            required
            aria-describedby="content-count"
          />
          <span
            id="content-count"
            className={`field-counter ${contentCount >= 500 ? 'valid' : ''}`}
          >
            {contentCount.toLocaleString()}자 / 최소 500자{' '}
            {contentCount >= 500 ? '✓' : `· ${500 - contentCount}자 더 써요`}{' '}
            <small>(공백 제외 / 최대 3,000자)</small>
          </span>
          <p className="kind-note">
            <Heart size={16} />
            친구를 존중하는 말로, 개인정보는 빼고 적어요.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              게시판 보기
            </button>
            <button className="button primary" disabled={!valid}>
              <Send size={16} />글 올리기
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function StoryDetail({
  id,
  nickname,
  onClose,
  onComment,
  onError,
}: {
  id: string;
  nickname: string;
  onClose: () => void;
  onComment: () => void;
  onError: (err: unknown) => void;
}) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [content, setContent] = useState('');
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [liking, setLiking] = useState(false);
  const [notice, setNotice] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const load = useCallback(async () => {
    setLoadError('');
    try {
      setPost(await api<PostDetail>(`/posts/${id}`));
    } catch (err) {
      setLoadError((err as Error).message);
      onError(err);
    }
  }, [id, onError]);
  useEffect(() => {
    void load();
  }, [load]);
  async function recommend() {
    if (liking) return;
    setLiking(true);
    setError('');
    try {
      const result = await api<{ like_count: number; liked: boolean }>(`/posts/${id}/like`, {
        method: 'POST',
      });
      setPost((current) => current && { ...current, ...result });
      onComment();
    } catch (err) {
      setError((err as Error).message);
      onError(err);
    } finally {
      setLiking(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const comment = await api<Comment & { mission: Mission }>(`/posts/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, ...(replyTo ? { parentId: replyTo.id } : {}) }),
      });
      setPost(
        (current) =>
          current && {
            ...current,
            comments: [...current.comments, comment],
            comment_count: current.comment_count + 1,
          },
      );
      setContent('');
      setReplyTo(null);
      setNotice(
        comment.parent_id
          ? '친구에게 답글을 남겼어요.'
          : post?.is_own
            ? '내 글에 댓글을 남겼어요. 미션은 친구 글에서 도전해요.'
            : comment.mission.completed
              ? '축하해요! 댓글 3개 미션을 완료했어요. 🎉'
              : `다정한 댓글을 남겼어요. 미션 ${comment.mission.count} / 3개!`,
      );
      onComment();
    } catch (err) {
      setError((err as Error).message);
      onError(err);
    } finally {
      setBusy(false);
    }
  }
  function startReply(comment: Comment) {
    setReplyTo(comment);
    setError('');
    setNotice('');
    commentInput.current?.focus();
  }
  const category = categories.find((item) => item.id === post?.category);
  function renderComment(comment: Comment, reply = false) {
    return (
      <li key={comment.id} className={reply ? 'reply-comment' : ''}>
        {reply && <CornerDownRight className="reply-arrow" aria-hidden="true" size={22} />}
        <Avatar name={comment.author} small />
        <div className="comment-body">
          <div className="comment-meta">
            <strong>{comment.author}</strong>
            <time dateTime={comment.created_at}>{dateLabel(comment.created_at, true)}</time>
          </div>
          <p>{comment.content}</p>
          {!reply && (
            <button className="reply-button" onClick={() => startReply(comment)}>
              <MessageCircle size={13} />
              답글 쓰기
            </button>
          )}
          {!reply && post?.comments.some((item) => item.parent_id === comment.id) && (
            <ol className="comments reply-list">
              {post.comments
                .filter((item) => item.parent_id === comment.id)
                .map((item) => renderComment(item, true))}
            </ol>
          )}
        </div>
      </li>
    );
  }
  return (
    <Modal title="우리 반 이야기" onClose={onClose} wide>
      {loadError ? (
        <div className="modal-state">
          <p className="error" role="alert">
            {loadError}
          </p>
          <button className="button secondary" onClick={() => void load()}>
            다시 불러오기
          </button>
        </div>
      ) : !post ? (
        <div className="modal-state" role="status">
          이야기를 가져오는 중이에요…
        </div>
      ) : (
        <>
          <article className="story-detail">
            <span className={`category-tag ${post.category}`}>
              {category?.emoji} {category?.label}
            </span>
            <h2>{post.title}</h2>
            <div className="detail-meta">
              <Avatar name={post.author} small />
              <strong>{post.author}</strong>
              <time dateTime={post.created_at}>{dateLabel(post.created_at, true)}</time>
            </div>
            <p className="story-content">{post.content}</p>
            <div className="post-reactions">
              <button
                className={`recommend-button ${post.liked ? 'active' : ''}`}
                aria-pressed={post.liked}
                onClick={() => void recommend()}
                disabled={liking}
              >
                <Heart size={20} fill={post.liked ? 'currentColor' : 'none'} />
                {post.liked ? '추천했어요' : '추천하기'} <b>{post.like_count}</b>
              </button>
              <span>좋은 생각에 마음을 보내요.</span>
            </div>
          </article>
          <section className="comment-section" aria-label="댓글">
            <h3>
              <MessageCircle size={19} />
              함께 나눈 이야기 <span>{post.comments.length}</span>
            </h3>
            {post.comments.length === 0 ? (
              <p className="comment-empty">첫 번째 다정한 한마디를 남겨 주세요.</p>
            ) : (
              <ol className="comments">
                {post.comments
                  .filter((comment) => !comment.parent_id)
                  .map((comment) => renderComment(comment))}
              </ol>
            )}
            <form onSubmit={submit} className="comment-form">
              <label htmlFor="comment-content">
                {replyTo ? `${replyTo.author}에게 답글 쓰기` : `${nickname}의 한마디`}
              </label>
              {replyTo && (
                <div className="reply-target">
                  <span>
                    <CornerDownRight size={16} aria-hidden="true" /> {replyTo.author}의 댓글에
                    답해요
                  </span>
                  <button type="button" className="reply-button" onClick={() => setReplyTo(null)}>
                    답글 취소
                  </button>
                </div>
              )}
              <textarea
                ref={commentInput}
                id="comment-content"
                rows={3}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="친구의 생각에 대한 내 의견과 까닭을 20자 이상 적어 주세요."
                required
                maxLength={500}
              />
              <div className="comment-actions">
                <span className={characterCount(content) >= 20 ? 'valid' : ''}>
                  {characterCount(content)}자 / 최소 20자 (공백 제외)
                </span>
                <button className="button primary" disabled={busy || characterCount(content) < 20}>
                  <Send size={15} />
                  {busy ? '남기는 중…' : replyTo ? '답글 남기기' : '댓글 남기기'}
                </button>
              </div>
              <p className="comment-guide">
                친구 글의 댓글 3개로 미션 도전! 대댓글과 내 글의 댓글은 미션에 포함되지 않아요.
              </p>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <p className="success-note" role="status">
                {notice}
              </p>
            </form>
          </section>
        </>
      )}
    </Modal>
  );
}

function useMission(revision: number, onError: (err: unknown) => void) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    api<Mission>('/mission', { signal: abort.signal })
      .then(setMission)
      .catch((err) => {
        if (!abort.signal.aborted) {
          setError(err.message);
          onError(err);
        }
      });
    return () => abort.abort();
  }, [revision, retry, onError]);
  return { mission, error, retry: () => setRetry((value) => value + 1) };
}

function MissionCard({ state }: { state: ReturnType<typeof useMission> }) {
  const { mission, error, retry } = state;
  return (
    <section
      className={`mission-card ${mission?.completed ? 'completed' : ''}`}
      aria-label="댓글 미션"
    >
      <div className="mission-header">
        <span className="mission-sticker">★ MISSION 01</span>
        <span className="mission-status">{mission?.completed ? '미션 1개 완료!' : '도전 중'}</span>
      </div>
      <h3>
        댓글 미션! <span>댓글 3개 쓰기</span>
      </h3>
      <p>
        친구의 글을 읽고, 내 생각을
        <br />
        20자 이상 정성껏 남겨요.
      </p>
      <div className="mission-steps" aria-label={`댓글 ${mission?.count ?? 0}개 완료`}>
        {[1, 2, 3].map((number) => (
          <span
            key={number}
            className={`mission-step ${(mission?.count ?? 0) >= number ? 'done' : ''}`}
          >
            {(mission?.count ?? 0) >= number ? <Check size={20} /> : number}
          </span>
        ))}
      </div>
      {error ? (
        <>
          <p className="error" role="alert">
            {error}
          </p>
          <button className="reply-button" onClick={retry}>
            다시 불러오기
          </button>
        </>
      ) : (
        <p className="mission-progress" role="status">
          {!mission
            ? '미션을 불러오는 중…'
            : mission.completed
              ? '참 잘했어요! 마음을 나누는 댓글 친구 🏅'
              : `${mission.count} / 3개 · ${3 - mission.count}개 더 쓰면 완료!`}
        </p>
      )}
      <small>
        공백·반복 문자·복사한 댓글은 인정되지 않아요.
        <br />
        대댓글과 내 글의 댓글은 미션에서 제외해요.
      </small>
    </section>
  );
}

function PostCard({ post, onClick }: { post: Post; onClick: () => void }) {
  const category = categories.find((item) => item.id === post.category)!;
  return (
    <button className={`post-card category-${post.category}`} onClick={onClick}>
      <span className={`category-tag ${post.category}`}>
        {category.emoji} {category.label}
      </span>
      <h3>{post.title}</h3>
      <p className="post-excerpt">{post.content}</p>
      <div className="card-footer">
        <span className="card-author">
          <Avatar name={post.author} small />
          <span>
            {post.author}
            <time dateTime={post.created_at}>{dateLabel(post.created_at)}</time>
          </span>
        </span>
        <span className="comment-count">
          <Heart size={15} />
          <span className="sr-only">추천 </span>
          {post.like_count ?? 0}
          <MessageCircle size={16} />
          <span className="sr-only">댓글 </span>
          {post.comment_count}
        </span>
      </div>
    </button>
  );
}

function Board({
  nickname,
  className,
  onLogout,
}: {
  nickname: string;
  className: string;
  onLogout: () => void;
}) {
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PostList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [compose, setCompose] = useState(true);
  const [detail, setDetail] = useState<string | null>(null);
  const [rules, setRules] = useState(false);
  const [toast, setToast] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const onError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onLogout();
    },
    [onLogout],
  );
  const missionState = useMission(revision, onError);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError('');
    api<PostList>(`/posts?category=${category}&q=${encodeURIComponent(search)}&page=${page}`, {
      signal: abort.signal,
    })
      .then(setData)
      .catch((err) => {
        if (!abort.signal.aborted) {
          setError(err.message);
          onError(err);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [category, search, page, revision, onError]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  function selectCategory(value: Category | 'all') {
    setCategory(value);
    setPage(1);
  }
  async function logout() {
    setLoggingOut(true);
    try {
      await api('/session', { method: 'DELETE' });
      onLogout();
    } catch (err) {
      setToast((err as Error).message);
    } finally {
      setLoggingOut(false);
    }
  }
  function created(post: Post) {
    setCompose(false);
    setCategory('all');
    setQuery('');
    setSearch('');
    setPage(1);
    refresh();
    setDetail(post.id);
    setToast('너의 이야기가 우리 반에 도착했어요!');
  }
  return (
    <div className="app-layout">
      <a className="skip-link" href="#stories">
        이야기 목록으로 건너뛰기
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="class-badge">
          <span className="class-icon">
            <Users size={20} />
          </span>
          <div>
            <strong>{className} 이야기방</strong>
            <span>함께라서 더 즐거운 곳</span>
          </div>
          <span className="online-dot" />
        </div>
        <span className="nav-label">우리의 공간</span>
        <nav aria-label="이야기 주제">
          <button
            className={category === 'all' ? 'nav-item active' : 'nav-item'}
            onClick={() => selectCategory('all')}
          >
            <LayoutGrid size={19} />
            <span>모든 이야기</span>
            {data && <span className="nav-count">{data.totals.posts}</span>}
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${category === item.id ? 'active' : ''}`}
              onClick={() => selectCategory(item.id)}
            >
              <span className="nav-emoji">{item.emoji}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <MissionCard state={missionState} />
        <div className="sidebar-promise">
          <span className="promise-icon">
            <Heart size={22} />
          </span>
          <strong>다정한 말 한마디의 힘</strong>
          <p>
            내가 받고 싶은 댓글을
            <br />
            친구에게 먼저 건네 봐요.
          </p>
          <button onClick={() => setRules(true)}>
            우리 반 약속 보기 <ArrowRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <Sprout size={16} />
          <span>마음이 자라는 작은 공간</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-location">
            <span className="mobile-brand">
              <BookOpen size={21} />
            </span>
            <span>우리 반</span>
            <ChevronRight size={15} />
            <strong>이야기 나누기</strong>
          </div>
          <div className="user-menu">
            <Avatar name={nickname} small />
            <span>
              <strong>{nickname}</strong>
              <span className="user-suffix"> 친구</span>
            </span>
            <button
              className="icon-button logout-button"
              title="나가기"
              aria-label="우리 반에서 나가기"
              disabled={loggingOut}
              onClick={() => void logout()}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="board-main">
          <section className="welcome-banner">
            <div className="welcome-copy">
              <span className="eyebrow">
                <Sun size={16} /> 반가워요, {nickname}!
              </span>
              <h1>
                탑텐반 학급누리집
                <br />
                <span>생각을 나누며 함께 자라요!</span>
              </h1>
              <p>나의 생각을 쓰고, 스스로 고치고, 친구의 마음도 만나 봐요.</p>
              <button className="button primary" onClick={() => setCompose(true)}>
                <Pencil size={17} />내 이야기 쓰기
              </button>
            </div>
            <Illustration />
          </section>
          <div className="mobile-mission">
            <MissionCard state={missionState} />
          </div>
          <section className="board-section" id="stories">
            <div className="section-heading">
              <div>
                <span className="eyebrow">우리 반 자유 게시판</span>
                <h2>
                  우리들의 이야기 <span>{data?.total ?? 0}</span>
                </h2>
              </div>
              <label className="search-box">
                <Search size={18} />
                <input
                  type="search"
                  aria-label="이야기 검색"
                  placeholder="어떤 이야기를 찾고 있나요?"
                  value={query}
                  maxLength={100}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="board-toolbar">
              <div className="filter-tabs" aria-label="이야기 필터">
                <button
                  className={category === 'all' ? 'selected' : ''}
                  onClick={() => selectCategory('all')}
                >
                  전체
                </button>
                {categories.map((item) => (
                  <button
                    key={item.id}
                    className={category === item.id ? 'selected' : ''}
                    onClick={() => selectCategory(item.id)}
                  >
                    {item.emoji} {item.label}
                  </button>
                ))}
              </div>
              <span className="sort-label">
                <ArrowDown size={14} /> 최신 이야기순
              </span>
            </div>
            <div className="board-content" aria-busy={loading}>
              {error ? (
                <div className="empty-state">
                  <p className="error" role="alert">
                    {error}
                  </p>
                  <button className="button secondary" onClick={refresh}>
                    다시 불러오기
                  </button>
                </div>
              ) : loading ? (
                <div className="post-grid" role="status" aria-label="이야기를 불러오는 중">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="skeleton-card">
                      <span />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>
              ) : data?.posts.length ? (
                <div className="post-grid">
                  {data.posts.map((post) => (
                    <PostCard key={post.id} post={post} onClick={() => setDetail(post.id)} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-illustration">
                    {search ? <Search size={29} /> : <Sprout size={36} />}
                  </span>
                  <h3>
                    {search
                      ? '아직 찾는 이야기가 없어요'
                      : category === 'all'
                        ? '우리 반의 첫 이야기를 기다려요'
                        : `${categories.find((item) => item.id === category)!.label}, 첫 이야기를 들려줘요`}
                  </h3>
                  <p>
                    {search
                      ? '다른 낱말로 찾아보거나 주제를 바꿔 보세요.'
                      : '좋아하는 것, 오늘 웃었던 일… 어떤 이야기든 좋아요.'}
                  </p>
                  <button
                    className="button primary"
                    onClick={() => {
                      if (search) {
                        setQuery('');
                        setSearch('');
                        selectCategory('all');
                      } else setCompose(true);
                    }}
                  >
                    {search ? <ArrowLeft size={16} /> : <Plus size={17} />}
                    {search ? '모든 이야기 보기' : '첫 이야기 쓰기'}
                  </button>
                </div>
              )}
            </div>
            {data && data.pages > 1 && (
              <nav className="pagination" aria-label="목록 페이지">
                <button
                  className="icon-button"
                  aria-label="이전 페이지"
                  disabled={page === 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {page} / {data.pages}
                </span>
                <button
                  className="icon-button"
                  aria-label="다음 페이지"
                  disabled={page === data.pages || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </nav>
            )}
            <div className="board-footnote">
              <Heart size={15} />
              <span>이야기 하나, 댓글 한 줄이 우리 반을 더 따뜻하게 만들어요.</span>
              <button onClick={() => setRules(true)}>
                우리의 약속 <ArrowRight size={13} />
              </button>
            </div>
          </section>
          <section className="writing-prompt">
            <span className="prompt-icon">
              <Sparkles size={23} />
            </span>
            <div>
              <strong>무슨 이야기를 쓸지 고민된다면?</strong>
              <p>“오늘 나를 웃게 한 작은 일”을 들려주는 건 어때요?</p>
            </div>
            <button className="button text-button" onClick={() => setCompose(true)}>
              이야기 시작하기 <ArrowRight size={16} />
            </button>
          </section>
          <footer className="board-footer">
            <span>탑텐반 학급누리집</span>
            <span>서로의 이야기를 소중히, 우리의 마음을 다정히.</span>
            <Flower2 size={18} />
          </footer>
        </main>
      </div>
      {compose && (
        <Composer
          nickname={nickname}
          initialCategory={category === 'all' ? 'daily' : category}
          onClose={() => setCompose(false)}
          onCreated={created}
          onError={onError}
        />
      )}
      {detail && (
        <StoryDetail
          id={detail}
          nickname={nickname}
          onClose={() => setDetail(null)}
          onComment={refresh}
          onError={onError}
        />
      )}
      {rules && (
        <Modal title="우리 반의 세 가지 약속" onClose={() => setRules(false)}>
          <div className="rules-content">
            <span className="rules-flower">
              <Flower2 size={40} />
            </span>
            <h2>함께 지키면 더 따뜻해요.</h2>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>서로에게 다정하게 말해요.</strong>
                  <p>생각이 달라도 괜찮아요. 친구의 마음을 존중해요.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>나와 친구의 정보를 지켜요.</strong>
                  <p>전화번호, 주소, 비밀번호는 글이나 댓글에 쓰지 않아요.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>어려운 일은 선생님과 함께해요.</strong>
                  <p>불편한 이야기를 보았다면 선생님에게 알려 주세요.</p>
                </div>
              </li>
            </ol>
            <button className="button primary" onClick={() => setRules(false)}>
              <Check size={17} /> 함께 약속할게요
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [className, setClassName] = useState('탑텐반');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const logout = useCallback(() => setNickname(null), []);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const config = await api<{ className: string }>('/config');
      setClassName(config.className);
      try {
        const session = await api<{ nickname: string }>('/session');
        setNickname(session.nickname);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 401)) throw err;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (loading)
    return (
      <div className="app-loading" role="status">
        <Brand />
        <span>우리 반의 문을 열고 있어요…</span>
      </div>
    );
  if (error)
    return (
      <div className="app-loading">
        <Brand />
        <p role="alert" className="error">
          {error}
        </p>
        <button className="button primary" onClick={() => void load()}>
          다시 연결하기
        </button>
      </div>
    );
  return nickname ? (
    <Board nickname={nickname} className={className} onLogout={logout} />
  ) : (
    <Login className={className} onLogin={setNickname} />
  );
}
