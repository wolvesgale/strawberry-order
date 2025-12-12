"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

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

  const agencyOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        orders
          .map((o) => o.agencyName)
          .filter((name): name is string => Boolean(name))
      )
    );
    return names;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesAgency =
        selectedAgency === "all" || !selectedAgency
          ? true
          : order.agencyName === selectedAgency;

      const targetDate = order.deliveryDate ?? order.createdAt;
      const targetMonth = targetDate ? targetDate.slice(0, 7) : "";
      const matchesMonth = selectedMonth
        ? targetMonth === selectedMonth
        : true;

      return matchesAgency && matchesMonth;
    });
  }, [orders, selectedAgency, selectedMonth]);

export default function AdminOrdersPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 認証 + 管理者ロールチェック
  useEffect(() => {
    async function checkAuth() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("supabase auth error", error);
      }

      const user = data?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      // profiles から role を取得
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("supabase profiles error", profileError);
        router.push("/login");
        return;
      }

      if (!profile || profile.role !== "admin") {
        // admin 以外は代理店用の一覧に飛ばす
        router.push("/agency/orders");
        return;
      }

      setEmail(user.email ?? null);
    }

    checkAuth();
  }, [router]);

  // 注文一覧取得
  useEffect(() => {
    async function fetchOrders() {
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

  async function updateOrder(
    id: string,
    patch: { status?: OrderStatus; unitPrice?: number | null; taxRate?: number | null }
  ) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch("/api/mock-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "更新に失敗しました。");
      }

      const json = await res.json();
      const updated: Order = json.order;

      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "更新に失敗しました。");
    } finally {
      setSavingId(null);
    }
  }

  function handleStatusChange(id: string, value: string) {
    updateOrder(id, { status: value as OrderStatus });
  }

  function handleUnitPriceChange(id: string, value: string) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              unitPrice:
                value === ""
                  ? null
                  : Number.isNaN(Number(value))
                  ? o.unitPrice
                  : Number(value),
            }
          : o
      )
    );
  }

  function handleTaxRateChange(id: string, value: string) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              taxRate:
                value === ""
                  ? null
                  : Number.isNaN(Number(value))
                  ? o.taxRate
                  : Number(value),
            }
          : o
      )
    );
  }

  function handleUnitPriceBlur(order: Order) {
    updateOrder(order.id, {
      unitPrice: order.unitPrice ?? null,
      taxRate: order.taxRate ?? null,
    });
  }

  function handleTaxRateBlur(order: Order) {
    updateOrder(order.id, {
      unitPrice: order.unitPrice ?? null,
      taxRate: order.taxRate ?? null,
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
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
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
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

        {error && (
          <p className="text-sm text-red-100 bg-red-900/40 border border-red-700 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              注文一覧（{filteredOrders.length}件）
            </h2>
            {loading && (
              <p className="text-xs text-slate-400">読み込み中...</p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3 text-xs text-slate-100">
            <label className="space-y-1">
              <span className="block text-slate-300">代理店フィルタ</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={selectedAgency}
                onChange={(e) => setSelectedAgency(e.target.value)}
              >
                <option value="all">すべての代理店</option>
                {agencyOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-slate-300">月フィルタ</span>
              <input
                type="month"
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </label>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80 border-b border-slate-800">
                <tr className="text-xs text-slate-400">
                  <th className="px-4 py-2 text-left">注文ID</th>
                  <th className="px-4 py-2 text-left">商品</th>
                  <th className="px-4 py-2 text-center">玉数/シート</th>
                  <th className="px-4 py-2 text-center">セット数</th>
                  <th className="px-4 py-2 text-center">到着希望日</th>
                  <th className="px-4 py-2 text-left">代理店</th>
                  <th className="px-4 py-2 text-right">単価</th>
                  <th className="px-4 py-2 text-right">税率</th>
                  <th className="px-4 py-2 text-right">小計(税抜)</th>
                  <th className="px-4 py-2 text-right">消費税</th>
                  <th className="px-4 py-2 text-right">合計(税込)</th>
                  <th className="px-4 py-2 text-center">ステータス</th>
                  <th className="px-4 py-2 text-center">受付日時</th>
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
                    <td className="px-4 py-2 text-xs text-slate-100">
                      {order.agencyName ?? "-"}
                    </td>

                    {/* 単価 */}
                    <td className="px-4 py-2 text-right text-xs text-slate-100">
                      <input
                        type="number"
                        className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-emerald-400 focus:ring-1令
 focus:ring-emerald-400"
                        value={order.unitPrice ?? ""}
                        onChange={(e) =>
                          handleUnitPriceChange(order.id, e.target.value)
                        }
                        onBlur={() => handleUnitPriceBlur(order)}
                      />
                    </td>

                    {/* 税率 */}
                    <td className="px-4 py-2 text-right text-xs text-slate-100">
                      <input
                        type="number"
                        className="w-16 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                        value={order.taxRate ?? ""}
                        onChange={(e) =>
                          handleTaxRateChange(order.id, e.target.value)
                        }
                        onBlur={() => handleTaxRateBlur(order)}
                      />
                    </td>

                    {/* 小計・税・合計 */}
                    <td className="px-4 py-2 text-right text-xs text-slate-100">
                      {formatCurrency(order.subtotal)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-slate-100">
                      {formatCurrency(order.taxAmount)}
                    </td>
                    <td className="px-4 py-2 text-right text-emerald-100 font-semibold text-xs">
                      {formatCurrency(order.totalAmount)}
                    </td>

                    {/* ステータス */}
                    <td className="px-4 py-2 text-center text-xs text-slate-100">
                      <select
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                        value={order.status}
                        onChange={(e) =>
                          handleStatusChange(order.id, e.target.value)
                        }
                        disabled={savingId === order.id}
                      >
                        <option value="pending">
                          {STATUS_LABELS["pending"]}
                        </option>
                        <option value="shipped">
                          {STATUS_LABELS["shipped"]}
                        </option>
                        <option value="canceled">
                          {STATUS_LABELS["canceled"]}
                        </option>
                      </select>
                    </td>

                    <td className="px-4 py-2 text-center text-xs text-slate-400 whitespace-nowrap">
                      {formatDateTime(order.createdAt)}
                    </td>
                  </tr>
                ))}

                {orders.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={13}
                      className="px-4 py-8 text-center text-xs text-slate-500"
                    >
                      現在登録されている注文はありません。
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
