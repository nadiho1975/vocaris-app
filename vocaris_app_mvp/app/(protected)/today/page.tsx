import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { toggleImportant, completeToday } from "@/app/actions";

export default async function TodayPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("daily_goal")
    .eq("user_id", user.id)
    .maybeSingle();

  const dailyGoal = settings?.daily_goal ?? 20;

  const { data: vocabs, error } = await supabase
    .from("vocab")
    .select("*")
    .order("id", { ascending: true })
    .limit(dailyGoal);

  if (error) {
    return <main className="p-6">단어를 불러오는 중 오류가 발생했습니다.</main>;
  }

  const vocabIds = vocabs?.map((v) => v.id) ?? [];

  const { data: userWords } = await supabase
    .from("user_words")
    .select("vocab_id,is_important")
    .eq("user_id", user.id)
    .in("vocab_id", vocabIds.length > 0 ? vocabIds : [-1]);

  const importantSet = new Set(
    userWords?.filter((x) => x.is_important).map((x) => x.vocab_id) ?? []
  );

  return (
    <main className="mx-auto max-w-3xl px-5 pb-28 pt-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">오늘 학습</h1>
          <p className="mt-3 text-lg text-slate-600">
            목표 {dailyGoal}개 · 표시 {vocabs?.length ?? 0}개
          </p>
        </div>

        <form action={completeToday.bind(null, vocabIds)}>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow"
          >
            학습완료
          </button>
        </form>
      </div>

      <div className="space-y-6">
        {vocabs?.map((v) => {
          const isImportant = importantSet.has(v.id);

          return (
            <article
              key={v.id}
              className="rounded-3xl border border-slate-900 bg-white p-7 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-4xl font-extrabold">{v.word}</h2>
                  <p className="mt-2 text-lg text-slate-500">
                    {v.priority_group}
                  </p>
                </div>

                <form action={toggleImportant.bind(null, v.id, !isImportant)}>
                  <button
                    type="submit"
                    className={`rounded-full border px-4 py-2 text-sm font-bold ${
                      isImportant
                        ? "border-yellow-500 bg-yellow-100 text-yellow-800"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {isImportant ? "★ 중요" : "☆ 체크"}
                  </button>
                </form>
              </div>

              {v.synonym && (
                <p className="mb-4 text-lg text-slate-600">
                  동의어: {v.synonym}
                </p>
              )}

              <p className="mb-7 text-3xl font-semibold leading-relaxed">
                {v.meaning_ko}
              </p>

              {v.example_en && (
                <p className="mb-4 text-xl leading-9 text-slate-800">
                  {v.example_en}
                </p>
              )}

              {v.example_ko && (
                <p className="text-xl leading-9 text-slate-600">
                  {v.example_ko}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}