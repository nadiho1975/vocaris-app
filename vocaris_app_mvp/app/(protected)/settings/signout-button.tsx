"use client";

import { signOut } from "@/app/actions";

export function SignOutButton() {
  return <button className="btn-secondary" onClick={async () => { await signOut(); window.location.href = "/login"; }}>로그아웃</button>;
}
