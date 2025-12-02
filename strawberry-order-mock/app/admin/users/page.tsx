// app/admin/users/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Role = "admin" | "agency";

type AdminUser = {
  id: string;
  email: string;
  role: Role;
  agencyId: string | null;
  agencyName: string | null;
  agencyCode: string | null;
};

type Agency = {
  id: string;
  name: string;
  code: string;
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 新規ユーザー作成フォーム
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<Role>("agency");
  const [createAgencyId, setCreateAgencyId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function init() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Supabase auth error", error);
      }
      if (!data?.user) {
        router.push("/login");
        return;
      }

      setAuthChecked(true);
      await fetchUsers();
    }

    init();
  }, [router]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        throw new Error(
          json.error ?? "認証ユーザー一覧の取得に失敗しました。"
        );
      }

      setUsers(json.users ?? []);
      setAgencies(json.agencies ?? []);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "ユーザー一覧の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!createEmail || !createPassword) {
      setError("メールアドレスと初期パスワードは必須です。");
      return;
    }

    if (createRole === "agency" && !createAgencyId) {
      setError("代理店ユーザーを作成する場合は所属代理店を選択してください。");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createEmail,
          password: createPassword,
          role: createRole,
          agencyId: createRole === "agency" ? createAgencyId : null,
        }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        throw new Error(json.error ?? "ユーザー作成に失敗しました。");
      }

      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("agency");
      setCreateAgencyId("");
      await fetchUsers();
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "ユーザー作成に失敗しました。");
    } finally {
      setCreating(false);
    }
  };

  const handleLocalRoleChange = (userId: string, newRole: Role) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
  };

  const handleLocalAgencyChange = (userId: string, newAgencyId: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              agencyId: newAgencyId || null,
              agencyName:
                agencies.find((a) => a.id === newAgencyId)?.name ?? null,
              agencyCode:
                agencies.find((a) => a.id === newAgencyId)?.code ?? null,
            }
          : u
      )
    );
  };

  const handleUpdateUser = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setError(null);

    if (user.role === "agency" && !user.agencyId) {
      setError("代理店ユーザーには所属代理店が必須です。");
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: user.role,
          agencyId: user.role === "agency" ? user.agencyId : null,
        }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        throw new Error(json.error ?? "プロフィールの更新に失敗しました。");
      }

      await fetchUsers();
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "プロフィールの更新に失敗しました。");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("このユーザーを削除しますか？")) return;
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        throw new Error(json.error ?? "ユーザー削除に失敗しました。");
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "ユーザー削除に失敗しました。");
    }
  };

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-300">認証の確認中です…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">ユーザー管理</h1>
            <p className="text-sm text-slate-400">
              代理店ユーザーと管理者ユーザーをここから管理します。
            </p>
          </div>
          <a
            href="/admin/orders"
            className="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            注文一覧（モック）へ
          </a>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* 新規ユーザー作成 */}
        <section className="mb-8 rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
          <h2 className="mb-4 text-lg font-semibold">新規ユーザー作成</h2>
          <form
            onSubmit={handleCreateUser}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                初期パスワード
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">権限</label>
              <select
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as Role)}
              >
                <option value="admin">管理者</option>
                <option value="agency">代理店</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">
                所属代理店
              </label>
              <select
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                value={createAgencyId}
                onChange={(e) => setCreateAgencyId(e.target.value)}
                disabled={createRole !== "agency"}
              >
                <option value="">(未設定)</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}（{a.code}）
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                代理店ユーザーとして作成する場合のみ、所属代理店を選択してください。
              </p>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {creating ? "作成中…" : "ユーザーを作成"}
              </button>
            </div>
          </form>
        </section>

        {/* ユーザー一覧 */}
        <section className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
          <h2 className="mb-4 text-lg font-semibold">ユーザー一覧</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-800/80 text-slate-300">
                  <th className="px-4 py-2 text-left font-medium">メール</th>
                  <th className="px-4 py-2 text-left font-medium">権限</th>
                  <th className="px-4 py-2 text-left font-medium">代理店</th>
                  <th className="px-4 py-2 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && users.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-4 text-center text-slate-400"
                    >
                      読み込み中です…
                    </td>
                  </tr>
                )}

                {!loading && users.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-4 text-center text-slate-500"
                    >
                      まだユーザーが登録されていません。
                    </td>
                  </tr>
                )}

                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-slate-800/80 hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 text-slate-100">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                        value={u.role}
                        onChange={(e) =>
                          handleLocalRoleChange(
                            u.id,
                            e.target.value as Role
                          )
                        }
                      >
                        <option value="admin">管理者</option>
                        <option value="agency">代理店</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                        value={u.agencyId ?? ""}
                        onChange={(e) =>
                          handleLocalAgencyChange(u.id, e.target.value)
                        }
                        disabled={u.role !== "agency"}
                      >
                        <option value="">(未設定)</option>
                        {agencies.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}（{a.code}）
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateUser(u.id)}
                          className="rounded-md border border-emerald-500/60 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id)}
                          className="rounded-md border border-red-500/60 px-3 py-1 text-xs text-red-200 hover:bg-red-500/10"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
