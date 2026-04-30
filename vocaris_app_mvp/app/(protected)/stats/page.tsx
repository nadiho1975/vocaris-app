import { createClient } from "@/lib/supabase-server";
import { daysAgoDateString, koreaDateString } from "@/lib/date";

async function loadPeriod(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, label: string, startDate: string) {
  const { data } = await supabase
    .from("study_logs")
    .select("studied_at, vocab_id, vocab(word, meaning_ko)")
    .eq("user_id", userId)
    .gte("studied_at", `${startDate}T00:00:00+09:00`)
    .order("studied_at", { ascending: false });

  const unique = new Map<number, any>();
  for (const row of data ?? []) if (!unique.has(row.vocab_id)) unique.set(row.vocab_id, row);
  return { label, count: unique.size, rows: Array.from(unique.values()) };
}

export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const periods = await Promise.all([
    loadPeriod(supabase, user.id, "오늘", koreaDateString()),
    loadPeriod(supabase, user.id, "최근 7일", daysAgoDateString(6)),
    loadPeriod(supabase, user.id, "최근 30일", daysAgoDateString(29))
  ]);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">학습 통계</h1>
        <p className="mt-1 text-slate-500">나열형 학습 기록 기준입니다.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {periods.map((p) => (
          <div key={p.label} className="card">
            <p className="text-sm text-slate-500">{p.label}</p>
            <p className="mt-2 text-4xl font-bold">{p.count}</p>
            <p className="mt-1 text-sm text-slate-500">개 학습</p>
          </div>
        ))}
      </div>
      {periods.map((p) => (
        <div key={p.label} className="card">
          <h2 className="text-xl font-bold">{p.label} 학습 단어</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {p.rows.length === 0 ? <p className="py-3 text-slate-500">기록 없음</p> : p.rows.map((row: any) => (
              <div key={`${p.label}-${row.vocab_id}`} className="py-3">
                <p className="font-semibold">{row.vocab?.word}</p>
                <p className="line-clamp-2 text-sm text-slate-500">{row.vocab?.meaning_ko}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
