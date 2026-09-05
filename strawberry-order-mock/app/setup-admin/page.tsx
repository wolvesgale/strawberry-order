"use client";

import { useState, type FormEvent } from "react";

export default function SetupAdminPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMessage({ type: "err", text: "パスワードが一致しません。" });
      return;
    }
    if (password.length < 8) {
      setMessage({ type: "err", text: "パスワードは8文字以上で入力してください。" });
      return;
    }
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/setup-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: "saiya-setup-2026", password }),
    });
    const json = await res.json();
    setLoading(false);
    if (res.ok) {
      setMessage({ type: "ok", text: "パスワードを設定しました。ログインページへ移動してください。" });
    } else {
      setMessage({ type: "err", text: json.error ?? "エラーが発生しました。" });
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-700 rounded-xl p-8 shadow-xl space-y-6">
        <h1 className="text-xl font-semibold text-center">管理者パスワード設定</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">新しいパスワード（8文字以上）</label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">パスワード（確認）</label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {message && (
            <p className={`text-sm rounded-md px-3 py-2 ${message.type === "ok" ? "text-green-400 bg-green-950/40 border border-green-500/40" : "text-red-400 bg-red-950/40 border border-red-500/40"}`}>
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {loading ? "設定中..." : "パスワードを設定する"}
          </button>
        </form>
        {message?.type === "ok" && (
          <a href="/login" className="block text-center text-sm text-rose-400 underline">
            ログインページへ
          </a>
        )}
      </div>
    </main>
  );
}
