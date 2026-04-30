# VOCARIS - 수능 영어 단어 학습 웹앱

간소화된 MVP입니다.

- 로그인 필수
- 오늘 학습 단어 자동 배정
- 영어 단어 / 뜻 / 예문 / 해석 / 동의어 나열
- 중요단어 체크 및 별도 탭 저장
- 최근 7일 빠른복습
- 일별 / 주별 / 월별 학습 통계
- 모바일 / 태블릿 / PC 반응형
- PWA manifest 포함

## 1. 설치

```bash
npm install
```

## 2. Supabase 설정

1. Supabase 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 전체 실행
3. `.env.example`을 `.env.local`로 복사
4. 값 입력

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_FOR_IMPORT_ONLY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

주의: `SUPABASE_SERVICE_ROLE_KEY`는 CSV import용입니다. 브라우저에 노출하면 안 됩니다.

## 3. 단어 DB import

최종 단어 CSV를 프로젝트 루트에 `vocab_final.csv`로 복사합니다.

CSV는 다음 컬럼을 지원합니다.

```text
vocab_id,vocab_new_id,word,meaning_ko,example_en,example_ko,동의어,entry_type,is_phrase,day,related_forms,source_list,source_count,priority_group
```

Python 패키지 설치:

```bash
pip install -r scripts/requirements.txt
```

import 실행:

```bash
python scripts/import_vocab_to_supabase.py vocab_final.csv
```

중요: 앱은 `vocab.id`를 사용자 기록의 기준으로 씁니다. importer는 `vocab_new_id`를 우선 사용합니다. 이후 단어 DB를 수정해도 `vocab_new_id`를 유지하면 사용자 기록이 유지됩니다.

## 4. 개발 실행

```bash
npm run dev
```

브라우저:

```text
http://localhost:3000
```

## 5. 배포

Vercel에 올리고, Vercel 환경변수에 `.env.local` 값을 넣으면 됩니다.

## 6. 현재 구현 화면

- `/login` 로그인 / 회원가입
- `/today` 오늘 학습
- `/important` 중요단어
- `/quick-review` 최근 7일 빠른복습
- `/stats` 학습 통계
- `/settings` 하루 학습 수 / 로그아웃

## 7. 단어 DB 업데이트 원칙

좋은 방식:

```text
기존 vocab_new_id 유지 + 뜻/예문/동의어만 수정 → 사용자 기록 유지
```

위험한 방식:

```text
vocab_new_id 재생성 → 중요단어/학습기록 연결 깨짐
```
