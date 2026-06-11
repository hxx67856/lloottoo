# 로또 번호 추첨기

한국 로또(6/45) 규칙에 맞는 웹 번호 추첨기입니다. UI는 `DESIGN1.md` 가이드(Bugatti 스타일)를 따릅니다.

## 실행 방법

### 방법 1 — 바로 열기

`lotto.html` 파일을 더블클릭하거나 브라우저로 드래그하면 추첨 기능을 바로 사용할 수 있습니다.  
챗봇(Gemini API)은 Vercel 배포 환경에서만 동작합니다.

### 방법 2 — 개발 서버

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:5173 로 접속하세요.

챗봇 API를 로컬에서 테스트하려면 Vercel CLI가 필요합니다.

```bash
npm run dev:vercel
```

### 방법 3 — Vercel 배포 (챗봇 포함)

1. 이 저장소를 Vercel에 연결합니다.
2. Vercel 프로젝트 환경 변수를 추가합니다. (아래 표 참고)
3. Supabase에 `signups` 테이블을 생성합니다. (`supabase/schema.sql` 실행)
4. 배포 후 추첨이 끝나면 챗봇 설명과 가입 팝업이 동작합니다.

`.env.example` 파일을 참고하세요. 비밀 키는 클라이언트에 노출되지 않으며 `/api/*` 서버리스 함수에서만 사용됩니다.

| Key | 용도 |
|-----|------|
| `GEMINI_API_KEY` | 챗봇 (Gemini API) |
| `SUPABASE_URL` | 가입 정보 저장 (Supabase 프로젝트 URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | 가입 정보 저장 (서버 전용, **절대 프론트에 노출 금지**) |

### 환경 변수 설정 체크리스트

1. Vercel → Project → **Settings** → **Environment Variables**
2. Key: `GEMINI_API_KEY` (철자·대소문자 정확히 일치)
3. **Production**, **Preview**, **Development** 모두 체크
4. 저장 후 **Deployments** → 최신 배포 **Redeploy** (캐시 없이 재배포 권장)

### API 키 연결 확인

배포 후 브라우저에서 아래 주소를 열어 `keyConfigured: true` 인지 확인하세요.

```
https://your-project.vercel.app/api/chat
```

`false`이면 환경 변수가 아직 배포에 반영되지 않은 것입니다.

## 기능

- 1~45 중 중복 없는 6개 번호 + 보너스 번호 1개 추첨
- 한 번에 최대 5세트까지 추첨
- Bugatti 스타일 모노크롬 당첨볼 UI
- 추첨기 애니메이션으로 공을 하나씩 꺼내는 연출
- 역대 1등 당첨번호 조회 (1회~최신 회차, 1등 당첨금·당첨자 수 포함, 회차·번호 검색)
- **추첨 설명 챗봇** — Gemini `gemini-2.5-flash-lite` 모델이 확률 통계를 바탕으로 추첨 결과를 설명

## 챗봇 동작

- 추첨 완료 후 자동으로 설명을 요청합니다.
- 서버에서 로또 조합 확률(예: 약 1/317,657,340)을 계산해 Gemini에 전달합니다.
- 추가 질문을 입력해 확률 관련 후속 대화가 가능합니다.

## Supabase 가입 정보 저장 설정

### 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com/dashboard)에서 새 프로젝트 생성
2. **Project Settings** → **API** 메뉴에서 아래 값 확인
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (secret)

### 2. 테이블 생성

Supabase 대시보드 → **SQL Editor** → `supabase/schema.sql` 내용 붙여넣기 → **Run**

`signups` 테이블 컬럼:

| 컬럼 | 설명 |
|------|------|
| `name` | 이름 |
| `phone` | 연락처 (숫자만 저장) |
| `email` | 이메일 (중복 불가) |
| `created_at` | 가입 신청 시각 |

### 3. Vercel 환경 변수 추가

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 Production/Preview/Development 모두에 추가한 뒤 **Redeploy** 합니다.

### 4. 저장 확인

가입 신청 후 Supabase → **Table Editor** → `signups`에서 데이터를 확인합니다.
