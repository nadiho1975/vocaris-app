"use client";

import { useTransition } from "react";
import { completeToday } from "@/app/actions";

export function CompleteButton({ vocabIds }: { vocabIds: number[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <button className="btn-primary w-full md:w-auto" disabled={pending} onClick={() => startTransition(() => completeToday(vocabIds))}>
      {pending ? "저장 중..." : "오늘 학습 완료"}
    </button>
  );
}
