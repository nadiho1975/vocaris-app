import { updateDailyGoal } from "@/app/actions";
import { createClient } from "@/lib/supabase-server";
import { SignOutButton } from "./signout-button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("user_settings").select("daily_goal").eq("user_id", user.id).maybeSingle();
  const goal = data?.daily_goal ?? 20;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">설정</h1>
        <p className="mt-1 text-slate-500">로그인 계정: {user.email}</p>
      </div>
      <form action={updateDailyGoal} className="card max-w-md space-y-4">
        <label className="block text-sm font-semibold">하루 학습 단어 수</label>
        <select className="input" name="daily_goal" defaultValue={goal}>
          {[10, 20, 30, 50, 80, 100].map((n) => <option key={n} value={n}>{n}개</option>)}
        </select>
        <button className="btn-primary" type="submit">저장</button>
      </form>
      <div className="card max-w-md">
        <SignOutButton />
      </div>
    </section>
  );
}
