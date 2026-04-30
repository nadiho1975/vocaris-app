import { WordCard, type WordItem } from "@/components/WordCard";
import { createClient } from "@/lib/supabase-server";
import { daysAgoDateString } from "@/lib/date";

export default async function QuickReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const start = daysAgoDateString(6);
  const { data: logs } = await supabase
    .from("study_logs")
    .select("vocab_id")
    .eq("user_id", user.id)
    .gte("studied_at", `${start}T00:00:00+09:00`);

  const ids = Array.from(new Set((logs ?? []).map((x) => x.vocab_id)));

  const { data: vocabRows } = ids.length
    ? await supabase.from("vocab").select("id, word, meaning_ko, example_en, example_ko, synonym, is_phrase, priority_group").in("id", ids)
    : { data: [] as any[] };

  const { data: userWords } = ids.length
    ? await supabase.from("user_words").select("vocab_id, is_important").eq("user_id", user.id).in("vocab_id", ids)
    : { data: [] as any[] };

  const importantMap = new Map((userWords ?? []).map((x) => [x.vocab_id, x.is_important]));
  const words = (vocabRows ?? []).map((x) => ({ ...x, is_important: importantMap.get(x.id) ?? false })) as WordItem[];

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">빠른복습</h1>
        <p className="mt-1 text-slate-500">최근 7일 동안 학습 완료한 단어를 나열합니다. 총 {words.length}개</p>
      </div>
      {words.length === 0 ? (
        <div className="card text-slate-500">최근 7일 학습 기록이 없습니다.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {words.map((item) => <WordCard key={item.id} item={item} />)}
        </div>
      )}
    </section>
  );
}
