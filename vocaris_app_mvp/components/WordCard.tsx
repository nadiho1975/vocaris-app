"use client";

import { useTransition } from "react";
import { toggleImportant } from "@/app/actions";

export type WordItem = {
  id: number;
  word: string;
  meaning_ko: string | null;
  example_en: string | null;
  example_ko: string | null;
  synonym: string | null;
  is_phrase: boolean | null;
  priority_group: string | null;
  is_important?: boolean | null;
};

export function WordCard({ item }: { item: WordItem }) {
  const [pending, startTransition] = useTransition();
  const important = Boolean(item.is_important);

  return (
    <article className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-bold tracking-tight">{item.word}</h3>
            {item.is_phrase && <span className="badge">숙어</span>}
            {item.priority_group && <span className="badge">{item.priority_group}</span>}
          </div>
          {item.synonym && <p className="mt-1 text-sm text-slate-500">동의어: {item.synonym}</p>}
        </div>
        <button
          className={important ? "btn-primary shrink-0" : "btn-secondary shrink-0"}
          disabled={pending}
          onClick={() => startTransition(() => toggleImportant(item.id, !important))}
        >
          {important ? "★ 중요" : "☆ 체크"}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-base leading-7 text-slate-900">{item.meaning_ko || "뜻 없음"}</p>
      {(item.example_en || item.example_ko) && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm leading-6">
          {item.example_en && <p className="font-medium text-slate-800">{item.example_en}</p>}
          {item.example_ko && <p className="mt-1 text-slate-600">{item.example_ko}</p>}
        </div>
      )}
    </article>
  );
}
