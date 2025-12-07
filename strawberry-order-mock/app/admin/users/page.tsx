'use client';

import { useEffect, useMemo, useState } from 'react';

type Agency = {
  id: string;
  name: string;
  code: string;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agency';
  agencyId?: string | null;
  createdAt: string;
};

type FetchResponse = {
  agencies: Agency[];
  users: AdminUser[];
};

export default function AdminUsersPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'agency'>('agency');
  const [agencyId, setAgencyId] = useState<string>('');
  const [newAgencyName, setNewAgencyName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

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

  async function handleCreate() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          role,
          agencyId: agencyId || null,
          newAgencyName: newAgencyName || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || 'ユーザー作成に失敗しました。');
      }

      setName('');
      setEmail('');
      setRole('agency');
      setAgencyId('');
      setNewAgencyName('');
      await fetchData();
      setMessage('ユーザーを作成しました。');
    } catch (e: any) {
      setError(e.message || 'ユーザー作成に失敗しました。');
    }
  }

  async function handleUpdate(user: AdminUser, inlineNewAgency: string) {
    setSavingId(user.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          agencyId: user.agencyId ?? null,
          newAgencyName: inlineNewAgency || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || '更新に失敗しました。');
      }

      await fetchData();
      setMessage('ユーザー情報を更新しました。');
    } catch (e: any) {
      setError(e.message || '更新に失敗しました。');
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
            <p className="text-xs text-slate-400">
              ユーザーのロールと所属代理店を管理します。新しい代理店もここから追加できます。
            </p>
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

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">新規ユーザー作成</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs text-slate-300">名前</label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例）山田 太郎"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-300">メール</label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@example.com"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs text-slate-300">ロール</label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'agency')}
              >
                <option value="admin">admin</option>
                <option value="agency">agency</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-300">所属代理店</label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={agencyId}
                onChange={(e) => setAgencyId(e.target.value)}
              >
                <option value="">(未設定)</option>
                {agencyOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-slate-300">新しい代理店名（任意）</label>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              value={newAgencyName}
              onChange={(e) => setNewAgencyName(e.target.value)}
              placeholder="例）前田"
            />
            <p className="text-[11px] text-slate-500">
              入力すると新しい代理店を作成し、その代理店に紐付けてユーザーを作成します。
            </p>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              作成する
            </button>
          </div>
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
  saving,
}: {
  user: AdminUser;
  agencies: Agency[];
  onUpdate: (user: AdminUser, inlineNewAgency: string) => Promise<void>;
  saving: boolean;
}) {
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>(
    user.agencyId ?? '',
  );
  const [inlineNewAgency, setInlineNewAgency] = useState('');

  useEffect(() => {
    setSelectedAgencyId(user.agencyId ?? '');
  }, [user.agencyId]);

  async function handleSave() {
    await onUpdate(
      { ...user, agencyId: selectedAgencyId || null },
      inlineNewAgency,
    );
    setInlineNewAgency('');
  }

  return (
    <tr className="border-t border-slate-800">
      <td className="px-3 py-2">
        <div className="font-medium text-slate-100">{user.name}</div>
        <div className="text-[10px] text-slate-500">{user.id}</div>
      </td>
      <td className="px-3 py-2 text-slate-200">{user.email}</td>
      <td className="px-3 py-2">
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-100">
          {user.role}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="space-y-2">
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
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[13px] text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
            value={inlineNewAgency}
            onChange={(e) => setInlineNewAgency(e.target.value)}
            placeholder="新しい代理店名を追加"
          />
        </div>
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
      </td>
    </tr>
  );
}
