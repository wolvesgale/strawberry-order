"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export type OrderStatus = "pending" | "shipped" | "canceled";

type Order = {
  id: string;
  orderNumber: string;
  productName: string;
  piecesPerSheet: number | null;
  quantity: number;
  deliveryDate: string | null;
  agencyName: string | null;
  status: OrderStatus;
  createdAt: string;
  unitPrice: number | null;
  taxRate: number | null;
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
};

type OrdersApiResponse = {
  orders: Order[];
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "受付",
  shipped: "発送済み",
  canceled: "キャンセル",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  const iso = d.toISOString();
  return iso.replace("T", " ").slice(0, 19);
}

function formatCurrency(value: number | null): string {
  if (value == null) return "-";
  return value.toLocaleString("ja-JP");
}

function getMonthKey(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  // 認証 & 管理者ロールチェック
  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("supabase auth error", error);
      }
      if (!data?.user) {
        router.push("/login");
        return;
      }

      setEmail(data.user.email ?? null);

      const user = data.user;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("supabase profiles error", profileError);
        setError("プロフィール情報の取得に失敗しました。");
        return;
      }

      if (!profile || profile.role !== "admin") {
        // 管理者以外は代理店用発注フォームへ
        router.push("/order");
        return;
      }
    }

    loadProfile();
  }, [router]);

  // 注文一覧取得（全件）
  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/mock-orders", { cache: "no-store" });
        if (!res.ok) throw new Error("注文一覧の取得に失敗しました。");
        const json = (await res.json()) as OrdersApiResponse;
        setOrders(json.orders ?? []);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "注文一覧の取得でエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  // 代理店名一覧（フィルタ用）
  const agencyOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        orders
          .map((o) => o.agencyName)
          .filter((name): name is string => Boolean(name))
      )
    );
    names.sort((a, b) => a.localeCompare(b, "ja"));
    return names;
  }, [orders]);

  // 月（YYYY-MM）一覧（配達日ベース）
  const monthOptions = useMemo(() => {
    const keys = Array.from(
      new Set(
        orders
          .map((o) => getMonthKey(o.deliveryDate ?? o.createdAt))
          .filter((k): k is string => Boolean(k))
      )
    );
    keys.sort().reverse(); // 新しい月が先頭
    return keys;
  }, [orders]);

  // フィルタ後の注文
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (agencyFilter !== "all") {
        if (!o.agencyName || o.agencyName !== agencyFilter) return false;
      }
      if (monthFilter !== "all") {
        const key = getMonthKey(o.deliveryDate ?? o.createdAt);
        if (key !== monthFilter) return false;
      }
      return true;
    });
  }, [orders, agencyFilter, monthFilter]);

  async function handleStatusOrPriceSave(order: Order) {
    setSavingId(order.id);
    setError(null);

    try {
      const res = await fetch("/api/mock-orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: order.id,
          status: order.status,
          unitPrice: order.unitPrice,
          taxRate: order.taxRate,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.error ?? "更新に失敗しました。";
        throw new Error(msg);
      }

      const json = (await res.json()) as { ok: boolean; order: Order };
      if (json.ok && json.order) {
        setOrders((prev) =>
          prev.map((o) => (o.id === json.order.id ? json.order : o))
        );
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "更新中にエラーが発生しました。");
    } finally {
      setSavingId(null);
    }
  }

  function handleLogout() {
    supabase.auth.signOut().finally(() => {
      router.push("/login");
    });
  }

  if (!email && !error && loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm text-slate-400">認証情報を確認しています...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              注文一覧（管理者用）
            </h1>
            <p className="text-sm text-slate-400">
              代理店経由で登録された発注が一覧で表示されます。
            </p>
            <p className="mt-1 text-xs text-slate-500">
              ログインメール：{email ?? "未ログイン"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/users"
              className="rounded-md border border-slate-500 bg-slate-700/10 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-600/30"
            >
              ユーザー管理
            </Link>
            <Link
              href="/order"
              className="rounded-md border border-emerald-500 bg-emerald-600/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
            >
              発注フォーム
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-md border border-red-500 bg-red-600/10 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/20"
            >
              ログアウト
            </button>
          </div>
        </header>

        {/* エラー表示 */}
        {error && (
          <p className="text-sm text-red-100 bg-red-900/40 border border-red-700 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {/* フィルタ */}
        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-100">
                注文一覧（{filteredOrders.length}件 / 全体{orders.length}件）
              </h2>
              {loading && (
                <p className="text-xs text-slate-400">読み込み中...</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-xs">
              <div className="space-y-1">
                <p className="text-slate-400">代理店フィルタ</p>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
                  value={agencyFilter}
                  onChange={(e) => setAgencyFilter(e.target.value)}
                >
                  <option value="all">すべての代理店</option>
                  {agencyOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <p className="text-slate-400">月フィルタ（到着希望日）</p>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                >
                  <option value="all">すべての月</option>
                  {monthOptions.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 一覧テーブル */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80 border-b border-slate-800">
                <tr className="text-xs text-slate-400">
                  <th className="px-4 py-2 text-left">注文ID</th>
                  <th className="px-4 py-2 text-left">商品</th>
                  <th className="px-4 py-2 text-center">玉数/シート</th>
                  <th className="px-4 py-2 text-center">セット数</th>
                  <th className="px-4 py-2 text-center">到着希望日</th>
                  <th className="px-4 py-2 text-center">代理店</th>
                  <th className="px-4 py-2 text-right">単価</th>
                  <th className="px-4 py-2 text-right">税率(%)</th>
                  <th className="px-4 py-2 text-right">小計(税抜)</th>
                  <th className="px-4 py-2 text-right">消費税</th>
                  <th className="px-4 py-2 text-right">合計(税込)</th>
                  <th className="px-4 py-2 text-center">ステータス</th>
                  <th className="px-4 py-2 text-center">受付日時</th>
                  <th className="px-4 py-2 text-center">保存</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-t border-slate-800 hover:bg-slate-900/60"
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-200">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-100">
                      {order.productName}
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-slate-100">
                      {order.piecesPerSheet != null
                        ? `${order.piecesPerSheet}玉`
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-slate-100">
                      {order.quantity}
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-slate-100">
                      {formatDate(order.deliveryDate)}
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-slate-100">
                      {order.agencyName ?? "-"}
                    </td>
                    <td className="px-2 py-2 text-right text-xs text-slate-100">
                      <input
                        type="number"
                        className="w-20 rounded-md border border-slate-700 bg-slate-900 px-1 py-0.5 text-right text-xs"
                        value={order.unitPrice ?? ""}
                        onChange={(e) => {
                          const value =
                            e.target.value === ""
                              ? null
                              : Number(e.target.value);
                          setOrders((prev) =>
                            prev.map((o) =>
                              o.id === order.id
                                ? { ...o, unitPrice: value }
                                : o
                            )
                          );
                        }}
                      />
                    </td>
                    <td className="px-2 py-2 text-right text-xs text-slate-100">
                      <input
                        type="number"
                        className="w-16 rounded-md border border-slate-700 bg-slate-900 px-1 py-0.5 text-right text-xs"
                        value={order.taxRate ?? ""}
                        onChange={(e) => {
                          const value =
                            e.target.value === ""
                              ? null
                              : Number(e.target.value);
                          setOrders((prev) =>
                            prev.map((o) =>
                              o.id === order.id
                                ? { ...o, taxRate: value }
                                : o
                            )
                          );
                        }}
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-slate-100">
                      {formatCurrency(order.subtotal)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-slate-100">
                      {formatCurrency(order.taxAmount)}
                    </td>
                    <td className="px-4 py-2 text-right text-emerald-100 text-xs font-semibold">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-slate-100">
                      <select
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        value={order.status}
                        onChange={(e) => {
                          const value = e.target
                            .value as OrderStatus;
                          setOrders((prev) =>
                            prev.map((o) =>
                              o.id === order.id
                                ? { ...o, status: value }
                                : o
                            )
                          );
                        }}
                      >
                        <option value="pending">
                          {STATUS_LABELS.pending}
                        </option>
                        <option value="shipped">
                          {STATUS_LABELS.shipped}
                        </option>
                        <option value="canceled">
                          {STATUS_LABELS.canceled}
                        </option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-slate-400 whitespace-nowrap">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-center text-xs">
                      <button
                        onClick={() =>
                          handleStatusOrPriceSave(order)
                        }
                        disabled={savingId === order.id}
                        className="rounded-md border border-emerald-500 bg-emerald-600/10 px-2 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60"
                      >
                        {savingId === order.id ? "保存中..." : "保存"}
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredOrders.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={14}
                      className="px-4 py-8 text-center text-xs text-slate-500"
                    >
                      条件に合致する注文はありません。
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
