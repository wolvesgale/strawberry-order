// strawberry-order-mock/app/admin/users/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";

type Role = "admin" | "agency";

type Agency = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
};

type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  role: Role;
  agencyId?: string | null;
  createdAt: string;
};

type AdminUsersApiResponse = {
  agencies: Agency[];
  users: AdminUserSummary[];
};

export default function AdminUsersPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("agency");
  const [agencyId, setAgencyId] = useState<string>("");
  const [newAgencyName, setNewAgencyName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 一覧読み込み
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/users", { cache: "no-store" });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error ?? "一覧の取得に失敗しました。");
        }

        const json = (await res.json()) as AdminUsersApiResponse;
        setAgencies(json.agencies ?? []);
        setUsers(json.users ?? []);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "一覧の取得でエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!name.trim()) {
      setError("名前を入力してください。");
      return;
    }
    if (!email.trim()) {
      setError("メールアドレスを入力してください。");
      return;
    }

    if (role === "agency" && !agencyId && !newAgencyName.trim()) {
      setError(
        "ロールが代理店の場合、既存代理店を選択するか、新しい代理店名を入力してください。"
      );
      return;
    }

    setSubmitLoading(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          role,
          agencyId: agencyId || null,
          newAgencyName: newAgencyName.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error ?? "ユーザー作成に失敗しました。");
      }

      setMessage("ユーザーを作成しました。初期パスワードでログインできます。");

      // 新規ユーザーを一覧に追加（軽く再描画）
      if (json?.user) {
        setUsers((prev) => [json.user as AdminUserSummary, ...prev]);
      } else {
        // 念のため再取得
        const reload = await fetch("/api/admin/users", { cache: "no-store" });
        if (reload.ok) {
          const data = (await reload.json()) as AdminUsersApiResponse;
          setAgencies(data.agencies ?? []);
          setUsers(data.users ?? []);
        }
      }

      // フォームクリア
      setName("");
      setEmail("");
      setRole("agency");
      setAgencyId("");
      setNewAgencyName("");
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "ユーザー作成に失敗しました。");
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* ヘッダー */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ユーザー管理</h1>
            <p className="mt-1 text-sm text-slate-400">
              ユーザーのロールと所属代理店を管理します。新しい代理店もここから追加できます。
            </p>
            <Link
              href="/admin/orders"
              className="mt-2 inline-flex items-center text-xs text-emerald-300 hover:text-emerald-200 underline underline-offset-4"
            >
              注文一覧へ戻る
            </Link>
          </div>

          {message && (
            <p className="text-xs sm:text-sm text-emerald-100 bg-emerald-900/40 border border-emerald-700 rounded-md px-3 py-2 max-w-xs">
              {message}
            </p>
          )}
        </header>

        {/* 新規ユーザー作成フォーム */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg space-y-4">
          <h2 className="text-lg font-semibold">新規ユーザー作成</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-200">
                名前
              </label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例）古田 貴香"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-200">
                メール
              </label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="例）test@example.com"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-200">
                  ロール
                </label>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  <option value="admin">admin（管理者）</option>
                  <option value="agency">agency（代理店）</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-200">
                  所属代理店（任意）
                </label>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  value={agencyId}
                  onChange={(e) => setAgencyId(e.target.value)}
                  disabled={role !== "agency"}
                >
                  <option value="">(未設定)</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}（{a.code}）
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  ロールが代理店の場合、既存代理店を選択するか下の「新しい代理店名」を入力してください。
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-200">
                新しい代理店名（任意）
              </label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={newAgencyName}
                onChange={(e) => setNewAgencyName(e.target.value)}
                placeholder="例）いちごの香り"
                disabled={role !== "agency"}
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitLoading}
                className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:hover:bg-emerald-500"
              >
                {submitLoading ? "作成中..." : "作成する"}
              </button>
            </div>
          </form>

          {error && (
            <p className="text-sm text-red-100 bg-red-900/40 border border-red-700 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </section>

        {/* ユーザー一覧 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">ユーザー一覧</h2>

          {loading ? (
            <p className="text-sm text-slate-400">読み込み中...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-400">
              まだユーザーが登録されていません。
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/80 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-300">
                      名前
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-300">
                      メール
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-300">
                      ロール
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-300">
                      代理店
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-300">
                      作成日
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const agency = agencies.find((a) => a.id === u.agencyId);
                    return (
                      <tr
                        key={u.id}
                        className="border-t border-slate-800 hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-2 whitespace-nowrap">
                          {u.name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {u.email}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {u.role}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {agency ? `${agency.name}（${agency.code}）` : "-"}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-400">
                          {u.createdAt?.slice(0, 10) ?? "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
