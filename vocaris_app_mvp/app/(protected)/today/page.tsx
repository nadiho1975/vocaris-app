import { CompleteButton } from "@/components/CompleteButton";
import { WordCard, type WordItem } from "@/components/WordCard";
import { createClient } from "@/lib/supabase-server";
import { koreaDateString } from "@/lib/date";

async function getDailyGoal(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("user_settings").select("daily_goal").eq("user_id", userId).maybeSingle();
  return data?.daily_goal ?? 20;
}

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = koreaDateString();
  const goal = await getDailyGoal(supabase, user.id);

  let { data: assignments } = await supabase
    .from("daily_assignments")
    .select("vocab_id")
    .eq("user_id", user.id)
    .eq("study_date", today)
    .order("assigned_order", { ascending: true });

  assignments = assignments ?? [];

  if (assignments.length < goal) {
    const existingIds = assignments.map((x) => x.vocab_id);
    const { data: candidateRows } = await supabase.rpc("pick_vocab_for_today", {
      p_user_id: user.id,
      p_limit: goal - assignments.length,
      p_exclude_ids: existingIds
    });

    const rows = (candidateRows ?? []).map((row: { id: number }, idx: number) => ({
      user_id: user.id,
      study_date: today,
      vocab_id: row.id,
      assigned_order: assignments.length + idx + 1
    }));

    if (rows.length > 0) {
      await supabase.from("daily_assignments").insert(rows);
      const refreshed = await supabase
        .from("daily_assignments")
        .select("vocab_id")
        .eq("user_id", user.id)
        .eq("study_date", today)
        .order("assigned_order", { ascending: true });
      assignments = refreshed.data ?? [];
    }
  }

  const vocabIds = assignments.map((x) => x.vocab_id);
  const { data: vocabRows } = await supabase
    .from("vocab")
    .select("id, word, meaning_ko, example_en, example_ko, synonym, is_phrase, priority_group")
    .in("id", vocabIds);

  const { data: userWords } = await supabase
    .from("user_words")
    .select("vocab_id, is_important")
    .eq("user_id", user.id)
    .in("vocab_id", vocabIds.length ? vocabIds : [-1]);

  const importantMap = new Map((userWords ?? []).map((x) => [x.vocab_id, x.is_important]));
  const vocabMap = new Map((vocabRows ?? []).map((x) => [x.id, { ...x, is_important: importantMap.get(x.id) ?? false }]));
  const words = vocabIds.map((id) => vocabMap.get(id)).filter(Boolean) as WordItem[];

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold">오늘 학습</h1>
          <p className="mt-1 text-slate-500">{today} · 목표 {goal}개 · 표시 {words.length}개</p>
        </div>
        <CompleteButton vocabIds={vocabIds} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {words.map((item) => <WordCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}
