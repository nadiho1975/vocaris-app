import { WordCard, type WordItem } from "@/components/WordCard";
import { createClient } from "@/lib/supabase-server";

export default async function ImportantPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_words")
    .select("vocab_id, is_important, vocab(id, word, meaning_ko, example_en, example_ko, synonym, is_phrase, priority_group)")
    .eq("user_id", user.id)
    .eq("is_important", true)
    .order("last_seen_at", { ascending: false });

  const words = (data ?? []).map((row: any) => ({ ...row.vocab, is_important: true })).filter(Boolean) as WordItem[];

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">중요단어</h1>
        <p className="mt-1 text-slate-500">체크 해제 전까지 계속 저장됩니다. 총 {words.length}개</p>
      </div>
      {words.length === 0 ? (
        <div className="card text-slate-500">아직 체크한 중요단어가 없습니다.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {words.map((item) => <WordCard key={item.id} item={item} />)}
        </div>
      )}
    </section>
  );
}
