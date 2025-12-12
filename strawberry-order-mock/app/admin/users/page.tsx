'use client';

import { useEffect, useMemo, useState } from 'react';

type Agency = {
  id: string;
  name: string;
  code: string | null;
};

type AdminUser = {
  id: string;
  name: string;
  email?: string | null;
  role: 'admin' | 'agency';
  agencyId: string | null;
  agencyName: string | null;
};

type FetchResponse = {
  agencies: Agency[];
  users: AdminUser[];
};

type CreatePayload = {
  name: string;
  email: string;
  role: 'admin' | 'agency';
  agencyId: string | null;
  newAgencyName: string | null;
};

export default function AdminUsersPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'agency'>('agency');
  const [newAgencyId, setNewAgencyId] = useState<string>('');
  const [newAgencyName, setNewAgencyName] = useState<string>('');

  const agencyOptions = useMemo(() => agencies, [agencies]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('ユーザー情報の取得に失敗しました。');
      const data = (await res.json()) as FetchResponse;
      setAgencies(data.agencies || []);
      setUsers(data.users || []);
    } catch (e: any) {
      console.error(e);
      setError(e.message || '読み込み中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(payload: CreatePayload) {
    setCreating(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || '作成に失敗しました。');
      }

      const json = await res.json();
      const createdUser = json.user as AdminUser;
      setUsers((prev) => [createdUser, ...prev]);
      setMessage(
        `ユーザーを作成しました。初期パスワード: ${json.initialPassword ?? '生成に失敗しました'}`,
      );
      setNewDisplayName('');
      setNewEmail('');
      setNewRole('agency');
      setNewAgencyId('');
      setNewAgencyName('');
    } catch (e: any) {
      console.error(e);
      setError(e.message || '作成に失敗しました。');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(user: AdminUser) {
    if (!user.name.trim()) {
      setError('名前を入力してください。');
      return;
    }
    setSavingId(user.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          name: user.name,
          role: user.role,
          agencyId: user.agencyId ?? null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || '更新に失敗しました。');
      }

      const json = await res.json();
      const updatedUser = json.user as AdminUser;

      setUsers((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));
      setMessage('ユーザー情報を更新しました。');
    } catch (e: any) {
      console.error(e);
      setError(e.message || '更新に失敗しました。');
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(userId: string) {
    if (!window.confirm('ユーザーを削除しますか？')) return;
    setSavingId(userId);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || '削除に失敗しました。');
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setMessage('ユーザーを削除しました。');
    } catch (e: any) {
      console.error(e);
      setError(e.message || '削除に失敗しました。');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-50">ユーザー管理</h1>
            <p className="text-xs text-slate-400">ユーザーのロールと所属代理店を管理します。</p>
          </div>
          <a
            href="/admin/orders"
            className="text-xs text-slate-300 underline hover:text-slate-100"
          >
            注文一覧へ戻る
          </a>
        </header>

        {message && (
          <p className="rounded-md border border-emerald-700 bg-emerald-900/40 px-3 py-2 text-sm text-emerald-100">
            {message}
          </p>
        )}

        {error && (
          <p className="rounded-md border border-red-700 bg-red-900/40 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        )}

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm space-y-2">
          <h2 className="text-sm font-semibold text-slate-100">新規ユーザー作成</h2>
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate({
                name: newDisplayName,
                email: newEmail,
                role: newRole,
                agencyId: newAgencyId || null,
                newAgencyName: newAgencyName.trim() || null,
              });
            }}
          >
            <label className="text-xs text-slate-200 space-y-1">
              <span className="block">名前</span>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                required
              />
            </label>
            <label className="text-xs text-slate-200 space-y-1">
              <span className="block">メールアドレス</span>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                type="email"
                required
              />
            </label>
            <label className="text-xs text-slate-200 space-y-1">
              <span className="block">ロール</span>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'agency')}
              >
                <option value="admin">admin</option>
                <option value="agency">agency</option>
              </select>
            </label>
            <label className="text-xs text-slate-200 space-y-1">
              <span className="block">所属代理店</span>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={newAgencyId}
                onChange={(e) => setNewAgencyId(e.target.value)}
              >
                <option value="">(未設定)</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-200 space-y-1">
              <span className="block">新しい代理店名</span>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                placeholder="新しい代理店名を追加"
                value={newAgencyName}
                onChange={(e) => setNewAgencyName(e.target.value)}
              />
              <p className="text-[10px] text-slate-400">
                代理店ユーザーの場合、所属代理店か新しい代理店名を入力してください。
              </p>
            </label>
            <div className="sm:col-span-2 lg:col-span-4 flex items-end justify-end">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {creating ? '作成中...' : '作成する'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">ユーザー一覧</h2>
            {loading && <span className="text-xs text-slate-400">読み込み中...</span>}
          </div>

          {users.length === 0 ? (
            <p className="text-xs text-slate-400">ユーザーがまだ登録されていません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-slate-100">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left">名前</th>
                    <th className="px-3 py-2 text-left">メール</th>
                    <th className="px-3 py-2 text-left">ロール</th>
                    <th className="px-3 py-2 text-left">所属代理店</th>
                    <th className="px-3 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      agencies={agencyOptions}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      saving={savingId === u.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function UserRow({
  user,
  agencies,
  onUpdate,
  onDelete,
  saving,
}: {
  user: AdminUser;
  agencies: Agency[];
  onUpdate: (user: AdminUser) => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
  saving: boolean;
}) {
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>(
    user.agencyId ?? '',
  );
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<'admin' | 'agency'>(user.role);

  useEffect(() => {
    setSelectedAgencyId(user.agencyId ?? '');
    setName(user.name);
    setRole(user.role);
  }, [user]);

  async function handleSave() {
    await onUpdate({
      ...user,
      name,
      role,
      agencyId: selectedAgencyId || null,
    });
  }

  return (
    <tr className="border-t border-slate-800">
      <td className="px-3 py-2">
        <input
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </td>
      <td className="px-3 py-2 text-slate-200">
        <input
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 outline-none"
          value={user.email ?? '-'}
          readOnly
        />
      </td>
      <td className="px-3 py-2">
        <select
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[13px] text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'agency')}
        >
          <option value="admin">admin</option>
          <option value="agency">agency</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[13px] text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
          value={selectedAgencyId}
          onChange={(e) => setSelectedAgencyId(e.target.value)}
        >
          <option value="">(未設定)</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(user.id)}
          disabled={saving}
          className="ml-2 inline-flex items-center rounded-md border border-red-500 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/10 disabled:opacity-60"
        >
          削除
        </button>
      </td>
    </tr>
  );
}
