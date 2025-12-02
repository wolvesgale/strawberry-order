// strawberry-order-mock/app/login/page.tsx
// app/login/page.tsx
"use client";

import type { FormEvent } from "react"; // ★ これを追加
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // ① メール＋パスワードでログイン
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError || !signInData.user) {
        setError("メールアドレスまたはパスワードが正しくありません。");
        return;
      }

      const user = signInData.user;

      // ② profiles テーブルから role と agency を取得
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, agency_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error(profileError);
        setError("プロフィール情報の取得に失敗しました。");
        return;
      }

      // ③ role に応じてリダイレクト
      if (profile?.role === "admin") {
        router.push("/admin/orders");
      } else {
        // 代理店（agent）やその他ロールは発注フォームへ
        router.push("/order");
      }
    } catch (err) {
      console.error(err);
      setError("ログイン処理で予期せぬエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-700 rounded-xl p-8 shadow-xl">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          代理店ログイン
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">メールアドレス</label>
            <input
              type="email"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">パスワード</label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-500/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400 text-center">
          ※ 管理者が発行したメールアドレス・パスワードでログインしてください。
        </p>
      </div>
    </main>
  );
}
