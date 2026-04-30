import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TodayPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 설정 불러오기
  const { data: settings } = await supabase
    .from("user_settings")
    .select("daily_goal")
    .eq("user_id", user.id)
    .maybeSingle();

  const dailyGoal = settings?.daily_goal ?? 20;

  // ❗ 여기 핵심
  const { data: vocabs, error } = await supabase
    .from("vocab")
    .select("*")
    .limit(dailyGoal);

  if (error) {
    return <div>에러 발생</div>;
  }

  return (
    <main style={{ padding: 20 }}>
      <h1>오늘 학습 ({dailyGoal}개)</h1>

      <div style={{ marginTop: 20 }}>
        {vocabs?.map((v) => (
          <div
            key={v.id}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              marginBottom: 12,
            }}
          >
            <b>{v.word}</b>
            <div>{v.meaning_ko}</div>
            <div>{v.example_en}</div>
            <div>{v.example_ko}</div>
          </div>
        ))}
      </div>
    </main>
  );
}