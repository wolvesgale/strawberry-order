// app/agency/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type OrderStatus = "pending" | "shipped" | "canceled";

type AgencyOrder = {
  id: string;
  orderNumber: string;
  productName: string;

  // 金額系は「あるかもしれない」扱いに
  unitPrice?: number | null;
  quantity: number;
  subtotalExTax?: number | null;
  taxAmount?: number | null;
  totalAmount?: number | null;

  status: OrderStatus;
  createdAt?: string;
  agencyName?: string;
  createdByEmail?: string;
};

export default function AgencyOrdersPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [orders, setOrders] = useState<AgencyOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    async function init() {
      // ログイン確認
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("supabase.auth.getUser error", error);
      }

      if (!data?.user) {
        router.push("/login");
        return;
      }

      const email = data.user.email ?? "";
      setUserEmail(email);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("agency_name")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("loadProfile error", profileError);
      }

      const agName = profile?.agency_name ?? "";
      setAgencyName(agName);

      // 注文取得
      try {
        setLoading(true);
        const res = await fetch("/api/mock-orders", { cache: "no-store" });

        if (!res.ok) {
          throw new Error("注文一覧の取得に失敗しました。");
        }

        const json = await res.json();
        const apiOrders = (json.orders ?? []) as any[];

        const mapped: AgencyOrder[] = apiOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          productName: o.product?.name ?? o.productName ?? "",
          unitPrice:
            typeof o.unitPrice === "number"
              ? o.unitPrice
              : typeof o.product?.unitPrice === "number"
              ? o.product.unitPrice
              : null,
          quantity: o.quantity ?? 0,
          subtotalExTax:
            typeof o.subtotalExTax === "number" ? o.subtotalExTax : null,
          taxAmount: typeof o.taxAmount === "number" ? o.taxAmount : null,
          totalAmount:
            typeof o.totalAmount === "number" ? o.totalAmount : null,
          status: o.status ?? "pending",
          createdAt: o.createdAt,
          agencyName: o.agencyName ?? "",
          createdByEmail: o.createdByEmail ?? "",
        }));

        // 自分に紐づくものだけ
        const filtered = mapped.filter((o) => {
          const byEmail =
            o.createdByEmail && email && o.createdByEmail === email;
          const byAgency =
            o.agencyName &&
            agName &&
            o.agencyName.trim() === agName.trim();
          return byEmail || byAgency;
        });

        setOrders(filtered);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "エラーが発生しました。");
      } finally {
        setLoading(false);
        setCheckingAuth(false);
      }
    }

    init();
    // router だけ依存にして、userEmail は内部で完結させる
  }, [router]);

  const formatCurrency = (value?: number | null) => {
    if (value == null || Number.isNaN(value)) return "-";
    return `${value.toLocaleString("ja-JP")}円`;
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("ja-JP");
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
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">自分の発注履歴</h1>
            <p className="text-sm text-slate-400">
              ログイン中の代理店／メールアドレスに紐づく発注だけを表示します。
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
              {agencyName && (
                <span className="inline-flex items-center rounded-full bg-slate-800/80 px-3 py-1">
                  代理店：{agencyName}
                </span>
              )}
              {userEmail && (
                <span className="inline-flex items-center rounded-full bg-slate-800/80 px-3 py-1">
                  メール：{userEmail}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <a
              href="/order"
              className="rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700"
            >
              発注フォームへ
            </a>
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
                <th className="px-4 py-3 text-right font-medium">合計</th>
                <th className="px-4 py-3 text-center font-medium">受付日時</th>
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    読み込み中です…
                  </td>
                </tr>
              )}

              {!loading && orders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    まだ発注はありません。
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
                      単価: {formatCurrency(order.unitPrice)}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    {order.quantity}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    {formatCurrency(order.subtotalExTax)}
                  </td>
                  <td className="px-4 py-3 align-top text-right font-semibold">
                    {formatCurrency(order.totalAmount)}
                  </td>
                  <td className="px-4 py-3 align-top text-center text-xs text-slate-400 whitespace-nowrap">
                    {formatDateTime(order.createdAt)}
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
