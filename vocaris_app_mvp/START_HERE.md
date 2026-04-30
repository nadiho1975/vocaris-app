# 실행 순서 요약

1. Supabase 프로젝트 생성
2. Supabase SQL Editor에서 `supabase/schema.sql` 실행
3. `.env.example` → `.env.local` 복사 후 키 입력
4. 최종 CSV를 `vocab_final.csv`로 프로젝트 루트에 복사
5. `pip install -r scripts/requirements.txt`
6. `python scripts/import_vocab_to_supabase.py vocab_final.csv`
7. `npm install`
8. `npm run dev`
9. `http://localhost:3000` 접속
