"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const supabase = createClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (result.error) setMessage(result.error.message);
    else if (mode === "signup") setMessage("가입 완료. 이메일 확인이 필요한 설정이면 메일을 확인하세요.");
    else window.location.href = "/today";
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-12 max-w-md space-y-4">
      <div>
        <h1 className="text-3xl font-bold">VOCARIS</h1>
        <p className="mt-1 text-sm text-slate-500">수능 영어 단어 학습 앱</p>
      </div>
      <input className="input" type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} required />
      <input className="input" type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required />
      {message && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}
      <button className="btn-primary w-full" type="submit">{mode === "login" ? "로그인" : "회원가입"}</button>
      <button className="btn-secondary w-full" type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "회원가입으로 전환" : "로그인으로 전환"}
      </button>
    </form>
  );
}
