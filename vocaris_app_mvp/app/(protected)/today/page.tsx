import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function TodayPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

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
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">오늘 학습</h1>
        <p className="mt-4 text-red-600">단어를 불러오는 중 오류가 발생했습니다.</p>
        <pre className="mt-4 whitespace-pre-wrap text-sm">{error.message}</pre>
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">오늘 학습</h1>
          <p className="mt-2 text-sm text-slate-600">
            목표 {dailyGoal}개 · 표시 {vocabs?.length ?? 0}개
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {vocabs?.map((v) => (
          <article key={v.id} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">{v.word}</h2>
                <p className="text-sm text-slate-500">{v.priority_group}</p>
              </div>
            </div>

            {v.synonym && (
              <p className="mb-2 text-sm text-slate-600">동의어: {v.synonym}</p>
            )}

            <p className="mb-4 text-lg">{v.meaning_ko}</p>

            {v.example_en && (
              <p className="mb-2 text-sm leading-6 text-slate-800">
                {v.example_en}
              </p>
            )}

            {v.example_ko && (
              <p className="text-sm leading-6 text-slate-600">{v.example_ko}</p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}