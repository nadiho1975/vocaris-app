import Link from "next/link";

const items = [
  ["/today", "오늘학습"],
  ["/important", "중요단어"],
  ["/quick-review", "빠른복습"],
  ["/stats", "통계"],
  ["/settings", "설정"]
];

export function Nav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:sticky md:top-0 md:bottom-auto">
      <div className="mx-auto flex max-w-5xl justify-around gap-1 px-2 py-2 md:justify-start md:px-4">
        {items.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
