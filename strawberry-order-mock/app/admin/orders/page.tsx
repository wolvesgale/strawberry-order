// strawberry-order-mock/app/admin/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export type OrderStatus = "pending" | "shipped" | "canceled";

export type AdminOrder = {
  id: string;
  orderNumber: string;
  productName: string;
  piecesPerSheet: number | null;
  quantity: number;
  postalAndAddress: string;
  recipientName: string;
  phoneNumber: string;
  deliveryDate: string | null;
  deliveryTimeNote: string | null;
  agencyName: string | null;
  createdByEmail: string | null;
  status: OrderStatus;
  createdAt: string;
  unitPrice: number | null;
  taxRate: number | null;
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
};

type OrdersApiResponse = {
  orders: AdminOrder[];
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "受付",
  shipped: "出荷済み",
  canceled: "キャンセル",
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}:${ss}`;
}

function formatYen(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${value.toLocaleString("ja-JP")}円`;
}

export default function AdminOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  // 認証チェック（ログインしてなければ /login に飛ばす）
  useEffect(() => {
    async function checkAuth() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("supabase auth error", error);
      }
      if (!data?.user) {
        router.push("/login");
        return;
      }
      setSessionEmail(data.user.email ?? null);
    }
    checkAuth();
  }, [router]);

  // 注文一覧取得
  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/mock-orders", { cache: "no-store" });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error ?? "注文一覧の取得に失敗しました。");
        }
        const json = (await res.json()) as OrdersApiResponse;
        const list = (json.orders ?? []).map((o) => ({
          ...o,
          unitPrice: o.unitPrice ?? null,
          taxRate: o.taxRate ?? null,
          subtotal: o.subtotal ?? null,
          taxAmount: o.taxAmount ?? null,
          totalAmount: o.totalAmount ?? null,
        }));
        setOrders(list);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "注文一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  async function handleChangeStatus(id: string, nextStatus: OrderStatus) {
    setError(null);
    setUpdatingId(id);

    try {
      const res = await fetch("/api/mock-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "ステータス更新に失敗しました。");
      }

      const json = await res.json();
      const updated: AdminOrder | undefined = json.order;

      setOrders((prev) =>
        prev.map((o) => (o.id === id && updated ? { ...o, ...updated } : o))
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "ステータス更新に失敗しました。");
    } finally {
      setUpdatingId(null);
    }
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
            {sessionEmail && (
              <p className="mt-1 text-xs text-slate-500">
                ログインメール：{sessionEmail}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/users"
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs sm:text-sm hover:border-emerald-400 hover:text-emerald-200"
            >
              ユーザー管理
            </Link>
            <Link
              href="/order"
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs sm:text-sm hover:border-emerald-400 hover:text-emerald-200"
            >
              発注フォーム
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs sm:text-sm hover:bg-slate-700"
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

        {/* 一覧 */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-lg">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">
              注文一覧（{orders.length}件）
            </p>
            {loading && (
              <p className="text-xs text-slate-400">読み込み中...</p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm text-left">
              <thead className="bg-slate-900/80 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2 whitespace-nowrap">注文ID</th>
                  <th className="px-3 py-2 whitespace-nowrap">商品</th>
                  <th className="px-3 py-2 whitespace-nowrap">玉数/シート</th>
                  <th className="px-3 py-2 whitespace-nowrap">セット数</th>
                  <th className="px-3 py-2 whitespace-nowrap">到着希望日</th>
                  <th className="px-3 py-2 whitespace-nowrap">代理店</th>
                  <th className="px-3 py-2 whitespace-nowrap">単価</th>
                  <th className="px-3 py-2 whitespace-nowrap">小計(税抜)</th>
                  <th className="px-3 py-2 whitespace-nowrap">消費税</th>
                  <th className="px-3 py-2 whitespace-nowrap">合計(税込)</th>
                  <th className="px-3 py-2 whitespace-nowrap">ステータス</th>
                  <th className="px-3 py-2 whitespace-nowrap">受付日時</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-3 py-4 text-center text-slate-400"
                    >
                      注文はまだ登録されていません。
                    </td>
                  </tr>
                )}

                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-t border-slate-800 hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-slate-100">
                      {o.orderNumber}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-100">
                      {o.productName}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {o.piecesPerSheet != null
                        ? `${o.piecesPerSheet}玉`
                        : "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {o.quantity}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {o.deliveryDate ?? "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {o.agencyName ?? "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatYen(o.unitPrice)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatYen(o.subtotal)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatYen(o.taxAmount)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-emerald-200">
                      {formatYen(o.totalAmount)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <select
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs sm:text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                        value={o.status}
                        disabled={updatingId === o.id}
                        onChange={(e) =>
                          handleChangeStatus(
                            o.id,
                            e.target.value as OrderStatus
                          )
                        }
                      >
                        <option value="pending">受付</option>
                        <option value="shipped">出荷済み</option>
                        <option value="canceled">キャンセル</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-300">
                      {formatDateTime(o.createdAt)}
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
