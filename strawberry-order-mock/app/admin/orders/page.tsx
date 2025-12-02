// app/admin/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type OrderStatus = "pending" | "shipped" | "canceled";

type AdminOrder = {
  id: string;
  orderNumber: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  subtotalExTax: number;
  taxAmount: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
};

export default function OrderPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ログインチェック & 注文一覧取得
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

      try {
        setLoading(true);
        const res = await fetch("/api/mock-orders", { cache: "no-store" });

        if (!res.ok) {
          throw new Error("注文一覧の取得に失敗しました。");
        }

        const json = await res.json();
        const apiOrders = (json.orders ?? []) as any[];

        const mapped: AdminOrder[] = apiOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          productName: o.product?.name ?? "",
          unitPrice: o.product?.unitPrice ?? 0,
          quantity: o.quantity,
          subtotalExTax: o.subtotalExTax,
          taxAmount: o.taxAmount,
          totalAmount: o.totalAmount,
          status: o.status,
          createdAt: o.createdAt,
        }));

        setOrders(mapped);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "エラーが発生しました。");
      } finally {
        setLoading(false);
        setCheckingAuth(false);
      }
    }

    init();
  }, [router]);

  // ログアウト処理
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout error", error);
    }
    router.push("/login");
  };

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-300">認証の確認中です…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">注文一覧（モック）</h1>
            <p className="text-sm text-slate-400">
              /order から発注したテストデータがここに一覧で表示されます。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => router.push("/order")}
              className="rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700"
            >
              発注フォームへ
            </button>

            <button
              type="button"
              onClick={() => router.push("/admin/users")}
              className="rounded-lg border border-indigo-500/70 bg-indigo-900/30 px-3 py-1.5 text-xs font-medium text-indigo-100 hover:bg-indigo-800/60"
            >
              ユーザー管理へ
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-red-500/60 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-800/60"
            >
              ログアウト
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/60">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-800/80 text-slate-300">
                <th className="px-4 py-3 text-left font-medium">注文ID</th>
                <th className="px-4 py-3 text-left font-medium">商品</th>
                <th className="px-4 py-3 text-right font-medium">セット数</th>
                <th className="px-4 py-3 text-right font-medium">小計</th>
                <th className="px-4 py-3 text-right font-medium">税額</th>
                <th className="px-4 py-3 text-right font-medium">合計</th>
                <th className="px-4 py-3 text-center font-medium">
                  ステータス
                </th>
                <th className="px-4 py-3 text-center font-medium">
                  受付日時
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    読み込み中です…
                  </td>
                </tr>
              )}

              {!loading && orders.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    まだ注文はありません。
                  </td>
                </tr>
              )}

              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-t border-slate-800/80 hover:bg-slate-800/60"
                >
                  <td className="px-4 py-3 align-top text-xs text-slate-300">
                    {order.orderNumber}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-sm font-medium text-slate-100">
                      {order.productName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      単価: {order.unitPrice.toLocaleString("ja-JP")}円
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    {order.quantity}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    {order.subtotalExTax.toLocaleString("ja-JP")}円
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    {order.taxAmount.toLocaleString("ja-JP")}円
                  </td>
                  <td className="px-4 py-3 align-top text-right font-semibold">
                    {order.totalAmount.toLocaleString("ja-JP")}円
                  </td>
                  <td className="px-4 py-3 align-top text-center">
                    <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-center text-xs text-slate-400 whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleString("ja-JP")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
