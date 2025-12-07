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
  product: {
    name: string;
    season: string;
  };
  quantity: number;
  piecesPerSheet: number;
  deliveryDate: string;
  deliveryAddress: string;
  status: 'pending' | 'shipped' | 'canceled';
  createdAt: string;
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [role] = useState<'admin' | 'agency'>('admin');

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
    <main className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-50">注文一覧（管理者用）</h1>
            <p className="text-xs text-slate-400">
              /order から発注した注文データがここに一覧で表示されます。
            </p>
          </div>
          <div className="flex items-center gap-3">
            {role === 'admin' && (
              <a
                href="/admin/users"
                className="inline-flex items-center rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700"
              >
                ユーザー管理へ
              </a>
            )}
            <a
              href="/order"
              className="text-xs text-slate-300 underline hover:text-slate-100"
            >
              発注フォームへ
            </a>
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-slate-400">読み込み中...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-400">
            まだ注文がありません。/order からテスト発注してみてください。
          </p>
        ) : (
          <div className="overflow-x-auto bg-slate-900 border border-slate-700 rounded-xl shadow-sm">
            <table className="min-w-full text-xs text-slate-100">
              <thead className="bg-slate-800 text-slate-100">
                <tr>
                  <th className="text-left px-3 py-2">注文ID</th>
                  <th className="text-left px-3 py-2">商品</th>
                  <th className="text-right px-3 py-2">玉数</th>
                  <th className="text-right px-3 py-2">セット数</th>
                  <th className="text-left px-3 py-2">到着希望日</th>
                  <th className="text-left px-3 py-2">ステータス</th>
                  <th className="text-left px-3 py-2">受付日時</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-300">
                      {o.orderNumber}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-100">{o.product.name}</div>
                      <div className="text-[10px] text-slate-400">{o.product.season}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{o.piecesPerSheet}玉</td>
                    <td className="px-3 py-2 text-right">{o.quantity}</td>
                    <td className="px-3 py-2 text-[10px] text-slate-300 whitespace-nowrap">
                      {o.deliveryDate}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-100">
                        {o.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleString('ja-JP')}
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
