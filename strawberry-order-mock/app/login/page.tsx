// app/login/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Supabase Auth でログイン
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      const user = signInData.user;
      if (!user) {
        setError('ログインに失敗しました。');
        return;
      }

      // 自分のプロフィール（role, agency_id）を取得
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, agency_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error(profileError);
        // プロフィールが取れない場合はとりあえず注文画面へ
        router.push('/order');
        return;
      }

      // ロールで遷移先を分ける
      if (profile.role === 'admin') {
        router.push('/admin/orders');
      } else {
        router.push('/order');
      }
    } catch (e) {
      console.error(e);
      setError('予期せぬエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-1">いちご発注システム</h1>
        <p className="text-sm text-slate-400 mb-6">
          ログインして発注フォーム／管理画面を利用します。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="password"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            {isSubmitting ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500 leading-relaxed">
          ※ ユーザー登録は管理者が Supabase の管理画面から行います。
          <br />
          &nbsp;&nbsp;（招待メール → パスワード設定 → 本画面からログイン）
        </p>
      </div>
    </main>
  );
}
