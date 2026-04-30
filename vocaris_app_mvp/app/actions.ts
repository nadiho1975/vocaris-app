"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function getUserOrThrow() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("로그인이 필요합니다.");
  return { supabase, user };
}

function getTodayKstDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function toggleImportant(vocabId: number, important: boolean) {
  const { supabase, user } = await getUserOrThrow();

  const { error } = await supabase.from("user_words").upsert(
    {
      user_id: user.id,
      vocab_id: vocabId,
      is_important: important,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,vocab_id" }
  );

  if (error) throw error;

  revalidatePath("/today");
  revalidatePath("/important");
}

export async function completeToday(vocabIds: number[]) {
  const { supabase, user } = await getUserOrThrow();
  const now = new Date().toISOString();

  if (vocabIds.length === 0) return;

  const logs = vocabIds.map((vocab_id) => ({
    user_id: user.id,
    vocab_id,
    studied_at: now,
  }));

  const { error: logError } = await supabase.from("study_logs").insert(logs);
  if (logError) throw logError;

  for (const vocab_id of vocabIds) {
    await supabase.rpc("increment_seen_count", {
      p_user_id: user.id,
      p_vocab_id: vocab_id,
    });
  }

  revalidatePath("/today");
  revalidatePath("/quick-review");
  revalidatePath("/stats");
}

export async function updateDailyGoal(formData: FormData) {
  const { supabase, user } = await getUserOrThrow();

  const goal = Number(formData.get("daily_goal") || 20);
  const safeGoal = Math.min(100, Math.max(5, goal));
  const now = new Date().toISOString();
  const today = getTodayKstDate();

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      daily_goal: safeGoal,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;

  // 핵심 수정:
  // 이미 오늘 80개가 배정되어 있으면 설정을 바꿔도 계속 80개가 보인다.
  // 설정 변경 시 오늘 배정표만 삭제해서 /today 진입 때 새 daily_goal 기준으로 다시 만들게 한다.
  const { error: deleteError } = await supabase
    .from("daily_assignments")
    .delete()
    .eq("user_id", user.id)
    .eq("study_date", today);

  if (deleteError) throw deleteError;

  revalidatePath("/settings");
  revalidatePath("/today");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}