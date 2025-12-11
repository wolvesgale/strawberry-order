// strawberry-order-mock/app/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
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

export default function AgencyOrdersPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 認証 & 代理店名取得
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

      // profiles から agency_id を取得
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("supabase profiles error", profileError);
        setError("プロフィール情報の取得に失敗しました。");
        return;
      }

      if (!profile?.agency_id) {
        setError(
          "代理店情報が設定されていません。管理者にお問い合わせください。"
        );
        return;
      }

      // agencies から代理店名を取得
      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .select("name")
        .eq("id", profile.agency_id)
        .maybeSingle();

      if (agencyError) {
        console.error("supabase agencies error", agencyError);
        setError("代理店情報の取得に失敗しました。");
        return;
      }

      if (!agency) {
        setError("代理店情報が見つかりません。");
        return;
      }

      setAgencyName(agency.name);
    }

    loadProfile();
  }, [router]);

  // 自分の代理店分の注文だけ取得
  useEffect(() => {
    if (!agencyName) return;

    async function fetchOrders() {
      setLoading(true);
      setError(null);
      try {
        const encodedAgencyName = encodeURIComponent(agencyName ?? "");
        const res = await fetch(
          `/api/mock-orders?agencyName=${encodedAgencyName}`,
          { cache: "no-store" }
        );
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
  }, [agencyName]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!agencyName && !error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm text-slate-400">認証情報を確認しています...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              発注一覧（{agencyName ?? "代理店"}様）
            </h1>
            <p className="text-sm text-slate-400">
              ご自身の代理店から登録された発注が一覧で表示されます。
            </p>
            <p className="mt-1 text-xs text-slate-500">
              ログインメール：{email ?? "未ログイン"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/order"
              className="rounded-md border border-emerald-500 bg-emerald-600/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
            >
              発注フォームに戻る
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
              発注一覧（{orders.length}件）
            </h2>
            {loading && (
              <p className="text-xs text-slate-400">読み込み中...</p>
            )}
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
                  <th className="px-4 py-2 text-right">小計(税抜)</th>
                  <th className="px-4 py-2 text-right">消費税</th>
                  <th className="px-4 py-2 text-right">合計(税込)</th>
                  <th className="px-4 py-2 text-center">ステータス</th>
                  <th className="px-4 py-2 text-center">受付日時</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
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
                      {STATUS_LABELS[order.status]}
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-slate-400 whitespace-nowrap">
                      {formatDateTime(order.createdAt)}
                    </td>
                  </tr>
                ))}

                {orders.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-xs text-slate-500"
                    >
                      現在登録されている発注はありません。
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
