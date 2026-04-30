import { createClient } from "@/lib/supabase-server";
import { updateDailyGoal } from "@/app/actions";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>로그인이 필요합니다.</div>;
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("daily_goal")
    .eq("user_id", user.id)
    .maybeSingle();

  const dailyGoal = settings?.daily_goal ?? 20;

  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold mb-4">설정</h1>

      <form action={updateDailyGoal} className="space-y-4">
        <div>
          <label className="block mb-2 font-semibold">
            하루 학습 단어 수
          </label>

          <select
            name="daily_goal"
            defaultValue={dailyGoal}
            className="border rounded px-3 py-2"
          >
            <option value="10">10개</option>
            <option value="20">20개</option>
            <option value="30">30개</option>
            <option value="50">50개</option>
            <option value="80">80개</option>
            <option value="100">100개</option>
          </select>
        </div>

        <button
          type="submit"
          className="border rounded px-4 py-2 font-semibold"
        >
          저장
        </button>
      </form>
    </main>
  );
}