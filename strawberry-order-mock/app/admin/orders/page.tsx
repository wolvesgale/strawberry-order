// app/admin/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type OrderStatus = "pending" | "shipped" | "canceled";

type AdminOrder = {
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
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        setError(null);

        // ① ログインチェック
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Supabase auth error", error);
        }
        if (!data?.user) {
          router.push("/login");
          return;
        }

        // ② 注文一覧取得
        const res = await fetch("/api/mock-orders", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("注文一覧の取得に失敗しました。");
        }

        const json = await res.json();
        const apiOrders = (json.orders ?? []) as any[];

        const mapped: AdminOrder[] = apiOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          productName: o.productName ?? o.product?.name ?? "",
          piecesPerSheet: o.piecesPerSheet ?? null,
          quantity: o.quantity ?? 0,
          postalAndAddress: o.postalAndAddress ?? "",
          recipientName: o.recipientName ?? "",
          phoneNumber: o.phoneNumber ?? "",
          deliveryDate: o.deliveryDate ?? null,
          deliveryTimeNote: o.deliveryTimeNote ?? null,
          agencyName: o.agencyName ?? null,
          createdByEmail: o.createdByEmail ?? null,
          status: (o.status as OrderStatus) ?? "pending",
          createdAt: o.createdAt ?? o.created_at ?? "",
        }));

        setOrders(mapped);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">注文一覧（管理者用モック）</h1>
            <p className="text-sm text-slate-400">
              代理店経由のモック注文が一覧で確認できます。
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/admin/users"
              className="rounded-lg border border-slate-700 px-3 py-1.5 hover:bg-slate-800"
            >
              ユーザー管理
            </Link>
            <Link
              href="/agency/orders"
              className="rounded-lg border border-slate-700 px-3 py-1.5 hover:bg-slate-800"
            >
              代理店別履歴
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-red-600 px-3 py-1.5 text-red-100 hover:bg-red-900/40"
            >
              ログアウト
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-800 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">注文ID</th>
                <th className="px-3 py-2 text-left">商品</th>
                <th className="px-3 py-2 text-right">玉数/シート</th>
                <th className="px-3 py-2 text-right">シート数</th>
                <th className="px-3 py-2 text-left">お届け先</th>
                <th className="px-3 py-2 text-left">到着希望</th>
                <th className="px-3 py-2 text-left">代理店</th>
                <th className="px-3 py-2 text-left">発注者</th>
                <th className="px-3 py-2 text-center">ステータス</th>
                <th className="px-3 py-2 text-left">受付日時</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    読み込み中です…
                  </td>
                </tr>
              )}

              {!loading && orders.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    まだ注文はありません。
                  </td>
                </tr>
              )}

              {!loading &&
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-t border-slate-800 hover:bg-slate-800/60"
                  >
                    <td className="px-3 py-2 align-top font-mono text-[11px]">
                      {order.orderNumber}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-xs font-medium">
                        {order.productName}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      {order.piecesPerSheet ?? "-"}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      {order.quantity}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <div>{order.postalAndAddress}</div>
                      <div className="text-slate-400">
                        {order.recipientName} / {order.phoneNumber}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <div>{order.deliveryDate ?? "-"}</div>
                      {order.deliveryTimeNote && (
                        <div className="text-slate-400">
                          {order.deliveryTimeNote}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      {order.agencyName ?? "-"}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      {order.createdByEmail ?? "-"}
                    </td>
                    <td className="px-3 py-2 align-top text-center">
                      <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-medium text-slate-100">
                        {order.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-slate-400">
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleString("ja-JP")
                        : "-"}
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
