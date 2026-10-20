# 부추

부업 정보와 익명 평가를 나누는 Next.js + Spring Boot 모노레포입니다. **모두의 마케터**와 **도와줘!** 두 게시판으로 나누고, 글 목록 중심의 간결한 커뮤니티 화면을 제공합니다. 기업의 게재 신청은 관리자 승인 후 공개되며, 이용자의 익명 평가는 작성 즉시 공개됩니다.

## 게시판

| 탭 | 주소 | 내용 |
| --- | --- | --- |
| 모두의 마케터 | `/` | 제휴 마케팅 부업 소개, 별점과 익명 이용 평가 |
| 도와줘! | `/help` | 기업의 서비스 홍보와 인재 모집 공고 |

도와줘! 게시글은 **기업 홍보** 또는 **인재 모집**을 선택하고 활동 지역, 모집 마감일, 보상과 지급 조건을 등록할 수 있습니다. 모두의 마케터에 등록된 부업만 익명 평가 대상입니다. 기존 추천 부업은 모두의 마케터로 유지됩니다.

PC 화면 양옆의 광고 배너는 [data/advertisements.json](data/advertisements.json)에서 이미지와 이동 주소를 각각 설정합니다. 이미지가 없으면 광고 자리 안내를 표시하며, 모바일에서는 양옆 광고를 숨깁니다. 자세한 등록 방법은 [광고 설정 안내](docs/advertisements.md)를 참고하세요.

구글 애드센스는 블라인드처럼 스크롤을 따라 피드 사이에 노출됩니다. `frontend/.env.local`에 `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-…`를 넣으면 홈의 오늘의 주제 아래, 주제 블록 두 줄마다, 사이드바 인기 부업 아래(300×250), 전체 글 목록 7줄마다, 글 상세 본문 아래와 페이지 끝에 광고가 나옵니다. 광고 단위 ID는 `NEXT_PUBLIC_ADSENSE_SLOT_FEED`·`_SIDEBAR`·`_ARTICLE`, 인피드 네이티브 단위를 쓰려면 `NEXT_PUBLIC_ADSENSE_FEED_LAYOUT_KEY`를 추가합니다([frontend/.env.example](frontend/.env.example) 참고). 게시자 ID를 비워 두면 개발 서버에서는 자리 표시만 보이고 배포에서는 아무것도 그리지 않으며, `/ads.txt`는 게시자 ID로 자동 생성됩니다. 광고는 화면 가까이 스크롤될 때만 요청하고 높이를 미리 확보해 본문이 밀리지 않습니다.

## 구성

```text
frontend/     Next.js 16.4.0 · React 19.1 · TypeScript · Tiptap 3
backend/      Spring Boot 3.5.16 · Java 21 · JDBC · Spring Security · Flyway
data/         기존 편집 추천 프로그램과 공식 출처
scripts/      백엔드 실행 및 로컬 PostgreSQL 도구
infra/        S3 연결 예시
.local/       로컬 PostgreSQL 데이터 (Git 제외)
```

`fatell`에서 확인한 Next.js 16.2.12 / Spring Boot 3.5.16을 기준으로 만들었으며, Next.js는 동일 16 계열의 보안 수정 버전 16.4.0을 사용합니다.

## 로컬 실행

Node.js 20.12 이상과 JDK 21, PostgreSQL이 필요합니다. Gradle Wrapper가 포함되어 있습니다.

```sh
npm install
npm run dev:backend
```

다른 터미널에서 프론트엔드를 실행합니다.

```sh
npm run dev
```

- [웹사이트](http://localhost:3000)
- [도와줘!](http://localhost:3000/help)
- [기업 게재 신청](http://localhost:3000/partners/apply)
- [홍보·모집 게재 신청](http://localhost:3000/partners/apply?board=HELP)
- [관리자](http://localhost:3000/admin)
- 백엔드 기본 주소: `http://localhost:8082`

먼저 사용할 DB와 `backend/.env`를 준비하세요. 현재 작업 환경은 사용자가 설정한 `backend/.env`의 로컬 PostgreSQL **5432 포트**를 사용합니다. 실제 연결 주소는 항상 `DB_URL` 설정을 따릅니다.

별도 개발용 DB가 필요할 때만 `npm run db:start`를 실행합니다. 이 선택 도구는 프로젝트의 `.local/postgres`에 전용 DB를 만들고 `127.0.0.1:5433`에서 실행합니다. Windows에 설치된 PostgreSQL을 자동 탐색합니다. 다른 설치 위치는 `PG_BIN` 환경변수로 지정하고, macOS/Linux에서는 PostgreSQL 실행 파일을 PATH에 추가합니다. 기존에 실행 중인 다른 PostgreSQL이나 데이터베이스는 변경하지 않습니다.

`backend/.env`가 없으면 `db:start`가 로컬 DB 암호와 관리자 암호를 무작위로 생성해 이 파일에 저장합니다. 관리자 아이디는 `ADMIN_USERNAME`, 비밀번호는 `ADMIN_PASSWORD`를 확인하세요. 암호를 변경하면 백엔드를 재시작합니다. `.env`는 Git에 포함되지 않습니다.

`npm run db:status`로 상태를 확인하고 `npm run db:stop`으로 이 프로젝트의 DB만 종료할 수 있습니다.

이미 사용 중인 로컬 DB가 있다면 `backend/.env.example`을 `backend/.env`로 복사하고 아래 값을 설정한 뒤 백엔드를 실행하면 됩니다. `db:start`는 별도 DB 주소가 설정되어 있으면 이를 덮어쓰지 않습니다.

```dotenv
DB_URL=jdbc:postgresql://localhost:5432/buchu
DB_USERNAME=buchu
DB_PASSWORD=your-database-password
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-admin-password
PORT=8082
SESSION_COOKIE_SECURE=false
```

`npm run dev:backend`는 `backend/.env`를 읽습니다. IntelliJ나 직접 `gradlew bootRun`으로 실행할 때는 동일한 환경변수를 실행 설정에 넣으세요. 이미 주입된 환경변수가 `.env`보다 우선합니다. 관리자 계정을 비워 두면 관리자 로그인이 비활성화됩니다.

Docker를 사용하려면 `.env` 값을 준비하고 아래 명령으로 **5433 포트**에 DB를 실행할 수도 있습니다. 이 경우 `DB_URL`의 포트도 5433으로 맞추세요. `db:start`로 만든 전용 DB와 동시에 실행하지 마세요.

```sh
docker compose --env-file backend/.env up -d db
```

백엔드 서버 주소가 다르면 `frontend/.env.local`에 `BACKEND_URL=http://localhost:8082`를 설정합니다. 프론트엔드 `/api/*`는 Spring API로 연결됩니다.

## 게재 신청과 심사

1. 기업이 게시판을 선택하고 기업명·담당자·연락처, 소개 정보, 대표 이미지, 상세페이지를 작성합니다. 도와줘!는 홍보·인재 모집 유형과 활동 지역·마감일·보상 조건을 함께 입력합니다.
2. **임시 저장** 후 복구 코드를 보관합니다. 현재 탭에서는 자동으로 이어서 작성할 수 있습니다. 다른 브라우저에서는 복구 코드로 불러옵니다.
3. **게재 신청**을 제출하면 승인 대기 상태가 됩니다. 대기 중에는 내용을 변경할 수 없습니다.
4. 관리자가 신청 정보를 확인하고 승인 또는 거절 사유를 등록합니다.
5. 승인한 게시글과 그 신청에서 선택한 이미지가 신청한 게시판에 공개됩니다. 거절된 신청은 사유를 확인하고 수정·재신청할 수 있습니다.

기업 담당자 이름·이메일·전화번호·사업자등록번호는 신청자와 관리자에게만 제공됩니다. 공개되는 정보는 기업명, 서비스 소개, 참여·정산 정보와 승인된 이미지입니다. 승인 이후 신청 내용은 수정할 수 없습니다.

별도 기업 회원가입 대신 신청별 복구 코드를 사용합니다. 복구 코드는 신청 내용을 읽고 수정할 수 있는 비밀 정보이므로 담당자만 보관하세요. 서버에는 신청 토큰의 해시만 저장됩니다. 현재 이메일 발송이나 기업 소유권 확인 기능은 포함하지 않습니다.

관리자는 환경변수로 설정한 단일 계정으로 로그인합니다. HttpOnly 세션과 CSRF 검증을 적용했으며, 로그인 시 세션을 갱신합니다. HTTPS 배포 시 `SESSION_COOKIE_SECURE=true`로 설정하세요. 승인·거절 이력은 DB에 남고, 중복 심사와 심사 중 수정은 차단됩니다.

## 익명 부업 평가

모두의 마케터 목록과 부업 상세페이지에서 별점과 평가를 확인하고, 회원가입 없이 평가를 작성할 수 있습니다. 별점은 **1~5점**, 제목은 **3~80자**, 본문은 **10~2,000자**입니다. 목록은 부업별 조회, 최신순·높은 별점순 정렬과 페이지 이동을 지원하며, 전체·부업별 평균 별점과 평가 수를 집계합니다. 평가가 없으면 빈 상태를 표시하며 가짜 평가를 넣지 않습니다.

평가는 관리자 사전 승인 없이 즉시 공개됩니다. 서버가 `익명`으로 시작하는 무작위 별칭을 생성하며, 이름·이메일 입력을 받지 않습니다. 도와줘! 게시글과 승인 전 신청에는 평가를 작성할 수 없습니다.

작성 시 발급되는 **삭제 코드**를 보관하세요. 현재 브라우저에는 삭제 키를 저장해 본인 평가를 삭제할 수 있으며, 다른 브라우저나 저장 데이터 삭제에 대비해 코드를 따로 보관할 수 있습니다. 서버에는 삭제 키의 해시만 저장하고, 공개 평가 목록에는 삭제 키를 포함하지 않습니다. 평가 삭제는 올바른 삭제 키와 CSRF 토큰이 있어야 가능합니다. 기업 신청의 복구 코드와 평가 삭제 코드는 서로 별개입니다.

관리자는 관리자 화면의 평가 관리에서 부업별 평가를 확인하고 삭제할 수 있습니다. 익명 평가 작성 요청은 접속 주소별로 분당 5회로 제한합니다. 평가 DB에는 작성자 IP나 별도 회원 식별자를 저장하지 않습니다.

## 상세페이지 편집기

[Tiptap](https://tiptap.dev/docs/editor/getting-started/overview)의 MIT 오픈소스 기능을 사용합니다. [Next.js 공식 연동 방식](https://tiptap.dev/docs/editor/getting-started/install/nextjs)에 맞춰 클라이언트에서 편집기를 초기화합니다.

- 제목, 굵게·기울임·밑줄, 글자색·강조색, 정렬
- 목록·인용문·구분선·표, 링크와 이미지
- 상세페이지 기본 템플릿, 미리보기, 실행 취소·다시 실행

유료 Pro 확장이나 외부 편집 서비스 계정은 필요하지 않습니다. 본문은 Tiptap JSON으로 저장합니다. 서버에서 노드·속성·URL을 검증하고, 공개 화면에서는 허용된 React 요소로 렌더링합니다. 임의 HTML을 실행하지 않습니다.

## 이미지: 로컬에서 S3/CDN으로 전환

기본 `STORAGE_PROVIDER=local`에서는 같은 프리사인 업로드 흐름을 로컬 저장소로 검증할 수 있습니다. 파일은 기본 `backend/uploads`에 저장합니다.

```text
업로드 URL 발급 → 브라우저 PUT → 완료 확인 및 이미지 검증
→ 비공개 고정 파일 복사 → 관리자 승인 → 공개 이미지
```

JPEG·PNG·WebP, 파일당 최대 8MiB, 신청당 최대 20개 이미지를 지원합니다. 업로드 링크는 10분간 유효합니다. 원본 파일명으로 저장 경로를 만들지 않으며, 크기·MIME·실제 파일 시그니처를 확인합니다. 완료된 이미지와 승인 이미지는 별도 키로 복사하므로 과거 업로드 링크로 게시된 이미지를 덮어쓸 수 없습니다.

S3 연결 시 `backend/.env`를 변경합니다.

```dotenv
STORAGE_PROVIDER=s3
STORAGE_BUCKET=your-bucket
STORAGE_REGION=ap-northeast-2
CDN_BASE_URL=https://your-cdn-domain.example
# 로컬에서 필요하면 설정. 배포 환경에서는 IAM 역할을 권장합니다.
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
# S3 호환 저장소에만 필요
STORAGE_ENDPOINT=
STORAGE_PATH_STYLE=false
```

프리사인 URL은 서버에서 생성하고 브라우저가 S3에 직접 PUT합니다. API는 완료 시 S3 객체를 확인합니다. `CDN_BASE_URL`은 버킷 루트에 대응하는 주소이며, 공개 이미지 URL 뒤에 `published/...` 경로가 붙습니다. CDN을 비워 두면 백엔드 이미지 경로로 제공합니다.

- S3 버킷은 비공개로 유지합니다. CDN의 원본 읽기 권한은 **`published/*`에만** 부여하세요. `staging/*`, `private/*`는 CDN에 공개하지 않습니다.
- 백엔드 IAM 역할은 해당 버킷의 `staging/*`, `private/*`, `published/*` 객체 읽기·쓰기·삭제 권한이 필요합니다. SSE-KMS를 사용하면 해당 키 권한도 준비합니다.
- [infra/s3-cors.example.json](infra/s3-cors.example.json)의 허용 Origin을 실제 프론트엔드 주소로 바꿔 버킷에 적용합니다.
- `staging/*`는 만료 업로드를 정리하는 수명 주기 규칙을 설정할 수 있습니다. 공개·비공개 확정 파일의 삭제 정책은 별도로 관리하세요.

S3/CDN 자격증명과 리소스는 포함되어 있지 않습니다. 연결 후 실제 업로드와 CDN 접근 정책을 해당 환경에서 확인해야 합니다. 이미 생성한 로컬 이미지 파일은 S3 설정 변경만으로 이전되지 않으며, 이전하려면 저장된 객체 키를 유지해 파일을 옮겨야 합니다.

## Flyway와 데이터

백엔드 시작 시 `backend/src/main/resources/db/migration`의 마이그레이션을 자동 적용합니다.

- `V1__submissions_and_reviews.sql`: 기업 신청, 비공개 토큰 해시, 심사 상태, 공개 식별자, 심사 이력
- `V2__upload_assets.sql`: 업로드 소유권, 만료·검증 상태, 파일 키, 공개 여부
- `V3__community_boards_and_anonymous_reviews.sql`: 신청 게시판(`MARKETER`·`HELP`), 익명 평가·별점·별칭·삭제 키 해시
- `V4__courses.sql`: 강의, 커리큘럼, 판매 조건과 구매 불가 기획 예시 6개
- `V5__course_orders.sql`: 주문, 결제 확인, 수강 기한과 학습 진도

JPA 자동 스키마 생성은 사용하지 않습니다. 적용된 마이그레이션을 수정하지 말고 다음 버전 파일을 추가하세요. 기존 추천 4개는 `data/programs.json`에서 관리하며, 승인된 기업 신청과 함께 공개 API에 합쳐집니다. 게시판 값이 없던 기존 데이터는 `MARKETER`로 처리합니다. 백엔드가 꺼져 있으면 초기 추천 목록만 대체 표시하며, 기업 신청·익명 평가·관리 기능은 백엔드와 DB가 실행되어 있어야 합니다.

## 주요 API

| API | 기능 |
| --- | --- |
| `GET /api/programs` · `GET /api/programs/{slug}` | 기존 추천 + 승인된 기업 정보, `board`·`helpType`·`location`·`deadline` 포함 |
| `GET /api/reviews` | 공개 익명 평가, `programSlug`·`sort=latest\|rating_desc`·`page`·`size` 지원 |
| `GET /api/reviews/summary` | 전체·부업별 평가 수와 평균 별점 |
| `POST /api/programs/{slug}/reviews` | 모두의 마케터 평가 작성, `{rating, title, content}` 입력 → `{review, deleteToken}` 반환 |
| `DELETE /api/reviews/{id}` | 본인 평가 삭제, `X-Review-Token` 필요 |
| `GET /api/auth/csrf` | 현재 세션의 CSRF 토큰 |
| `POST /api/submissions/drafts` | 신청 초안과 복구 토큰 생성 |
| `GET/PUT /api/submissions/{id}` | 신청 조회·임시 저장, `X-Submission-Token` 필요 |
| `POST /api/submissions/{id}/submit` | 심사 요청 |
| `POST /api/submissions/{id}/uploads/presign` | 이미지 PUT URL 발급 |
| `POST /api/submissions/{id}/uploads/{uploadId}/complete` | 업로드 검증·완료 |
| `POST /api/admin/login` · `POST /api/admin/logout` | 관리자 세션 |
| `GET /api/admin/submissions` · `GET /api/admin/submissions/{id}` | 상태·검색·페이지별 목록과 상세 |
| `POST /api/admin/submissions/{id}/review` | 승인·거절과 심사 의견 |
| `GET /api/admin/reviews` | 관리자 평가 목록, 공개 평가와 동일한 필터·정렬·페이지 매개변수 |
| `DELETE /api/admin/reviews/{id}` | 관리자 평가 삭제 |

변경 요청은 CSRF 헤더가 필요합니다. 서명된 이미지 PUT만 예외이며, 그 URL의 토큰을 검증합니다. 관리자 전용 API는 세션 인증이 추가로 필요합니다.

## 검증 명령

```sh
npm run typecheck
npm run build
npm run test:backend
```

백엔드 테스트 **75개**가 통과했습니다. 기존 신청·심사·이미지 검증에 더해 게시판 호환성, 도와줘! 승인과 정보 공개, 익명 평가 입력 검증·집계·삭제 권한·관리자 삭제·요청 제한을 확인합니다. `backend`에서 `gradlew.bat test bootJar`를 실행해 테스트와 실행 파일 빌드를 함께 검증할 수도 있습니다(macOS/Linux: `./gradlew test bootJar`).

백엔드 테스트는 독립 H2 DB에 실제 Flyway V1~V5 마이그레이션을 적용합니다. 로컬 PostgreSQL 운영 데이터는 테스트에서 사용하지 않습니다. 저장소 테스트는 로컬 파일과 S3 어댑터의 모의 동작을 확인합니다.

## 부업 클래스 · 개별 구매

상단 **부업 클래스** 탭에서 부업 전용 강의를 탐색합니다. 클래스101의 탐색·상세·커리큘럼 흐름을 참고하고, 부추에서는 **주당 시간·추가 실습비·완성할 결과물**을 기준으로 비교하도록 구성했습니다.

- `/courses`: 6개 분야, 검색·조건 필터·정렬, 최대 3개 강의 비교
- `/courses/{slug}`: 강의 소개, 준비물, 커리큘럼, 무료 미리보기, 강사와 환불 안내
- `/courses/{slug}/checkout`: 비회원 개별 구매, 복구 코드 보관, Toss 결제위젯 v2
- `/classroom` · `/classroom/{orderId}`: 주문 복구, 수업·영상·진도 저장
- `/admin`: 강의 등록·수정·발행·판매 종료, 주문 조회·실제 전액 환불

현재 6개 강의는 **기획 예시**이며 구매할 수 없습니다. 실제 강의 자료와 가격·판매 조건을 등록하고 `/backend/.env`에 `COURSE_PAYMENTS_ENABLED=true`, `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`를 설정한 뒤 결제를 테스트하세요. 기본값은 판매 비활성화입니다. 실제 PG 결제·정산은 아직 검증하지 않았습니다.

구매 토큰은 브라우저에 저장하고 서버에는 해시만 저장합니다. 유료 수업은 구매 토큰·결제 상태·수강 기한을 검증하며, 수업 조회 시 결제사 상태도 재확인합니다. Toss에 `https://서비스도메인/api/payments/webhook`과 `PAYMENT_STATUS_CHANGED`를 등록하면 확인된 외부 전액 취소도 반영합니다. 이 웹훅 경로만 추가로 CSRF 예외이며, 페이로드 대신 결제사를 직접 재조회해 처리합니다.

현재 강의 영상은 주소를 등록하는 방식입니다. 영상 업로드·변환과 비공개 CDN 서명 주소 발급은 아직 연결하지 않았습니다. 기업 게재 신청의 프리사인 이미지 업로드는 기존 기능을 사용합니다.

| API | 기능 |
| --- | --- |
| `GET /api/courses` · `GET /api/courses/{slug}` | 공개 강의·커리큘럼, 유료 수업 내용 제외 |
| `GET /api/courses/{slug}/lessons/{lessonId}/preview` | 지정한 수업만 무료 미리보기 |
| `GET/POST /api/admin/courses` · `PUT /api/admin/courses/{id}` | 강의 운영 |
| `GET /api/payments/config` | 결제 가능 여부·공개 클라이언트 키 |
| `POST /api/course-orders` | 서버 가격으로 주문 생성·구매 토큰 발급 |
| `GET /api/course-orders/{id}` · `POST /api/course-orders/{id}/confirm` | 구매 토큰으로 주문 조회·결제 확인 |
| `GET /api/course-orders/{id}/course` · `GET /api/course-orders/{id}/lessons/{lessonId}` | 유효한 구매자의 강의 정보·수업 |
| `POST /api/course-orders/{id}/lessons/{lessonId}/progress` | 학습 진도 저장 |
| `GET /api/admin/course-orders` · `POST /api/admin/course-orders/{id}/cancel` | 주문 조회·전액 환불 |
| `POST /api/payments/webhook` | 서버 재조회 후 확인된 외부 전액 취소 반영 |

구매자 API는 `X-Order-Token` 헤더가 필요합니다. 상세한 기획과 연결 순서는 [강의 기획](docs/course-product-plan.md), [강의 운영 안내](docs/course-operations.md)를 참고하세요.
