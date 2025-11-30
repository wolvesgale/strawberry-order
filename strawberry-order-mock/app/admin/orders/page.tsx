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

  useEffect(() => {
    async function init() {
      // 1) Supabase 認証チェック
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("Supabase auth error", authError);
      }

      const user = authData?.user;

      if (!user) {
        // 未ログイン → /login に飛ばす
        router.push("/login");
        return;
      }

      // 2) プロフィールから role を取得（admin 以外はフォーム画面へ）
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Failed to load profile", profileError);
        router.push("/login");
        return;
      }

      if (!profile || profile.role !== "admin") {
        // 代理店ユーザーなど → 自分の注文フォームへ
        router.push("/order");
        return;
      }

      // 3) 注文一覧取得
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
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">注文一覧（モック）</h1>
            <p className="text-sm text-slate-400">
              /order から発注したテストデータがここに一覧で表示されます。
            </p>
          </div>
          <a
            href="/order"
            className="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            発注フォームへ
          </a>
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
                <th className="px-4 py-3 text-center font-medium">ステータス</th>
                <th className="px-4 py-3 text-center font-medium">受付日時</th>
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
