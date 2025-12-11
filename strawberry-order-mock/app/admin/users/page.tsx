// strawberry-order-mock/app/admin/users/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

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
  // ログインメール表示用
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  // 一覧データ
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);

  // 新規作成フォーム
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("agency");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  const [newAgencyName, setNewAgencyName] = useState("");

  // UI状態
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ログインユーザー情報取得
  useEffect(() => {
    async function fetchSession() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("supabase auth error", error);
      }
      setSessionEmail(data?.user?.email ?? null);
    }
    fetchSession();
  }, []);

  // 一覧取得
  async function fetchAdminData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "ユーザー一覧の取得に失敗しました。");
      }
      const json = (await res.json()) as AdminUsersApiResponse;
      setAgencies(json.agencies ?? []);
      setUsers(json.users ?? []);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "ユーザー一覧の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAdminData();
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

    if (role === "agency") {
      if (!selectedAgencyId && !newAgencyName.trim()) {
        setError(
          "ロールが代理店の場合、既存代理店を選択するか新規代理店名を入力してください。"
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          role,
          agencyId: selectedAgencyId || null,
          newAgencyName: newAgencyName.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error ?? "ユーザー作成に失敗しました。");
      }

      setMessage("ユーザーを作成しました。初期パスワードは共通値が設定されています。");

      // フォームリセット
      setName("");
      setEmail("");
      setRole("agency");
      setSelectedAgencyId("");
      setNewAgencyName("");

      // 一覧再取得
      await fetchAdminData();
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "ユーザー作成に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  const agencyMap = new Map<string, Agency>();
  agencies.forEach((a) => agencyMap.set(a.id, a));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* ヘッダー */}
        <header className="space-y-2 sm:flex sm:items-start sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ユーザー管理</h1>
            <p className="text-sm text-slate-400">
              ユーザーのロールと所属代理店を管理します。新しい代理店もここから追加できます。
            </p>
            <p className="mt-1 text-xs text-slate-500">
              ログインメール：{sessionEmail ?? "未ログイン"}
            </p>
            <Link
              href="/admin/orders"
              className="mt-2 inline-flex items-center text-xs text-emerald-300 hover:text-emerald-200 underline underline-offset-4"
            >
              注文一覧へ戻る
            </Link>
          </div>

          {message && (
            <p className="mt-3 sm:mt-0 text-xs sm:text-sm text-emerald-100 bg-emerald-900/40 border border-emerald-700 rounded-md px-3 py-2 max-w-xs">
              {message}
            </p>
          )}
        </header>

        {/* 新規ユーザー作成フォーム */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">
            新規ユーザー作成
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 md:grid-cols-2 md:gap-6"
          >
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
                type="email"
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="例）user@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-200">
                ロール
              </label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="agency">agency（代理店）</option>
                <option value="admin">admin（管理者）</option>
              </select>
            </div>

            {/* 代理店関連 */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-200">
                所属代理店（任意）
              </label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={selectedAgencyId}
                onChange={(e) => setSelectedAgencyId(e.target.value)}
                disabled={role !== "agency"}
              >
                <option value="">(未設定)</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                代理店ロールの場合、既存代理店を選択するか下の「新しい代理店名」を入力してください。
              </p>
            </div>

            <div className="space-y-1 md:col-span-2">
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

            <div className="md:col-span-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:hover:bg-emerald-500"
              >
                {submitting ? "作成中..." : "作成する"}
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
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">
              ユーザー一覧
            </h2>
            {loading && (
              <span className="text-xs text-slate-400">読み込み中...</span>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900">
                <tr className="text-xs text-slate-400">
                  <th className="px-3 py-2 text-left font-medium">名前</th>
                  <th className="px-3 py-2 text-left font-medium">メール</th>
                  <th className="px-3 py-2 text-left font-medium">ロール</th>
                  <th className="px-3 py-2 text-left font-medium">代理店</th>
                  <th className="px-3 py-2 text-left font-medium">作成日時</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map((u) => {
                  const agency = u.agencyId
                    ? agencyMap.get(u.agencyId) ?? null
                    : null;
                  return (
                    <tr key={u.id} className="hover:bg-slate-900/60">
                      <td className="px-3 py-2 text-slate-100">{u.name}</td>
                      <td className="px-3 py-2 text-slate-200">{u.email}</td>
                      <td className="px-3 py-2 text-slate-200">{u.role}</td>
                      <td className="px-3 py-2 text-slate-200">
                        {agency ? agency.name : "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-400 text-xs">
                        {u.createdAt?.slice(0, 19).replace("T", " ") ?? "-"}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-4 text-center text-xs text-slate-500"
                    >
                      まだユーザーが登録されていません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
