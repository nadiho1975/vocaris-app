import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function saveDailyGoal(formData: FormData) {
  "use server";

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const dailyGoal = Number(formData.get("daily_goal") ?? 20);

  await supabase.from("user_settings").upsert({
    user_id: user.id,
    daily_goal: dailyGoal,
    updated_at: new Date().toISOString(),
  });

  redirect("/settings");
}

export default async function SettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("daily_goal")
    .eq("user_id", user.id)
    .maybeSingle();

  const dailyGoal = settings?.daily_goal ?? 20;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">설정</h1>

      <form action={saveDailyGoal} className="space-y-4">
        <div>
          <label className="block mb-2">하루 학습 단어 수</label>

          <select
            name="daily_goal"
            defaultValue={dailyGoal}
            className="border p-2 rounded"
          >
            <option value="10">10개</option>
            <option value="20">20개</option>
            <option value="30">30개</option>
            <option value="50">50개</option>
          </select>
        </div>

        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded"
        >
          저장
        </button>
      </form>
    </main>
  );
}