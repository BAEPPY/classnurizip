# 클래스누리집

아이들이 학급 코드와 별명으로 입장해 글과 댓글을 나누는 학급 게시판입니다. GitHub에서 코드를 관리하고 Vercel로 배포합니다. Sites는 사용하지 않습니다.

## 기능

- 학급 코드 + 별명 입장, 7일간 유지되는 서버 세션, 로그아웃
- 입장한 친구만 글 목록과 댓글 열람 가능
- 일상 이야기 / 궁금해요 / 책 이야기 / 자랑해요
- 글 작성, 댓글 작성, 키워드 검색, 주제 필터, 페이지 이동
- 휴대폰 화면 지원, 키보드로 사용하는 대화상자, 우리 반 약속
- 학급 코드를 바꾸면 기존 입장 세션 무효화

한 배포에 한 학급을 위한 첫 버전입니다. 별명은 계정이나 본인 인증이 아니며, 같은 별명을 여러 명이 사용할 수 있습니다. 교사용 관리 화면, 게시물 수정·삭제·신고 기능은 아직 포함하지 않습니다.

## 로컬 개발

Node.js **24.19.0**과 npm을 사용합니다. 외부 계정이나 DB 비밀번호 없이 실행할 수 있습니다.

```bash
npm ci
npm run dev
```

기본 포트는 `3000`입니다. 시작 시 생성되는 `.data/class-code.txt`에서 학급 코드를 확인하고 별명과 함께 입력합니다. 이 파일을 버전 관리하거나 공개하지 마세요. `.data/postgres`에는 PGlite 기반 PostgreSQL 데이터가 저장되어 재시작해도 유지됩니다. 이 경로를 지우면 로컬 글·댓글·세션도 없어집니다.

설정이 필요하면 `.env.example`을 참고해 `.env`를 만드세요. 기존 `.env`는 덮어쓰지 마세요. `CLASS_CODE`는 6~128글자이며 충분히 추측하기 어려운 값을 권장합니다. `CLASS_NAME`으로 학급 표시 이름을 바꿀 수 있습니다. 로컬 데이터와 배포한 Neon 데이터는 별개이며 자동으로 복사하지 않습니다.

```bash
npm run build        # TypeScript 검사 + 정적 화면 빌드
npm start            # 빌드된 화면과 API 실행
npm test             # 인증, 글·댓글, 검색, 검증, 재시작 후 보존 검사
npm run test:e2e      # 브라우저로 두 친구의 작성 흐름과 휴대폰 화면 검사
```

브라우저 테스트 전에 `npm run build`가 필요합니다. Chromium이 없으면 `npx playwright install chromium`을 실행하세요. 테스트는 임시 데이터베이스와 3100번 포트를 사용하며 개발 중 작성한 글을 건드리지 않습니다.

클라우드 작업은 이미 격리된 환경입니다. 기존 `/workspace/classnurizip` 체크아웃을 사용하며, 사용자가 요청하지 않는 한 Git worktree를 추가하지 않습니다. 이 환경에서 npm 캐시 권한 문제가 생기면 `npm ci --cache /workspace/.npm-cache`를 사용합니다.

## GitHub → Vercel 배포

1. GitHub 저장소 `BAEPPY/classnurizip`에 코드를 올립니다.
2. Vercel의 **Add New → Project**에서 이 GitHub 저장소를 가져옵니다. Framework는 **Vite**, Node.js는 **24.x**, Build Command는 `npm run build`, Output Directory는 `dist`입니다. 저장소의 `vercel.json`이 API 함수와 경로를 설정합니다.
3. Vercel Marketplace/Storage에서 **Neon Postgres**를 연결합니다. 앱은 Neon의 HTTPS 드라이버를 사용합니다. 다른 PostgreSQL 제공자의 연결 문자열은 그대로 호환된다고 가정하지 마세요.
4. Vercel 프로젝트의 환경 변수에 아래 값을 설정합니다. 비밀 값은 GitHub 파일이나 채팅에 붙여 넣지 않습니다.

| 변수           | 용도                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL` | Neon PostgreSQL 연결 문자열. Neon 연결 시 자동 추가되었다면 재사용합니다.       |
| `CLASS_CODE`   | 아이들에게 알려 줄 학급 코드. 로컬 자동 생성 코드는 Vercel에 복사되지 않습니다. |
| `CLASS_NAME`   | 선택. 예: `햇살반`. 기본값은 `우리 반`입니다.                                   |

5. 환경 변수를 적용한 후 배포합니다. Preview와 Production에 사용할 데이터베이스를 구분하세요. Preview에서 작성한 테스트 글이 실제 학급에 섞이지 않도록 별도 Neon 브랜치/DB를 사용합니다.
6. 배포 후 입장 전 접근 차단, 올바른 코드로 입장, 글 작성, 다른 브라우저의 댓글 작성, 새로고침 후 보존을 확인합니다. `/api/health`는 DB 연결을 검사합니다.

Vercel에서는 로컬 파일 DB를 사용하지 않습니다. 필수 환경 변수가 없으면 API는 503을 반환하며 글을 임시 파일에 저장하지 않습니다. 세션 쿠키는 Vercel에서 `HttpOnly`, `SameSite=Lax`, `Secure`로 설정됩니다. Neon은 최초 연결 때 테이블을 생성하므로 연결 사용자에게 해당 스키마의 테이블 생성 권한이 필요합니다. 공개 배포에는 Vercel 계정의 프로젝트 연결과 실제 Neon 설정이 필요합니다.

## 구조

| 경로                          | 내용                                      |
| ----------------------------- | ----------------------------------------- |
| `src/`                        | React + TypeScript 화면                   |
| `server/app.mjs`              | 공통 Express API, 인증·입력 검사          |
| `server/database.mjs`         | 로컬 PGlite / 배포 Neon PostgreSQL 연결   |
| `server/index.mjs`            | 로컬 개발·빌드 실행 서버                  |
| `api/index.mjs`               | Vercel 서버리스 진입점                    |
| `tests/`                      | API 통합 검사 및 Playwright 브라우저 검사 |
| `.github/workflows/check.yml` | GitHub push/PR 빌드·검사                  |

입력은 SQL 매개변수로 전달하고 React가 일반 텍스트로 표시합니다. 요청 크기 제한, 세션별 작성 빈도 제한, 잘못된 코드 입장 빈도 제한, 외부 Origin 쓰기 거부를 적용합니다. 빈도 제한은 실행 인스턴스별이며 여러 Vercel 인스턴스에 걸친 전역 제한이나 교사의 콘텐츠 관리 기능을 대신하지 않습니다.
