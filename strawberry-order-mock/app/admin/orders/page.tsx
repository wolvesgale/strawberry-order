"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export type OrderStatus = "pending" | "shipped" | "canceled";

type Order = {
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

export default function AdminOrdersPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [role] = useState<'admin' | 'agency'>('admin');

      // 未ログイン → /login
      if (!data?.user) {
        router.push("/login");
        return;
      }

      setEmail(data.user.email ?? null);

      // profiles から role を取得
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("supabase profiles error", profileError);
        // 取得できない場合は安全側に倒して代理店画面へ
        router.push("/order");
        return;
      }

      if (!profile || profile.role !== "admin") {
        // 管理者以外は代理店用フォームへリダイレクト
        router.push("/order");
        return;
      }

      // ここまで来たら「admin」として OK
      setAuthChecked(true);
    }

    checkAuthAndRole();
  }, [router]);

  // 注文一覧取得（admin と判定された後にだけ実行）
  useEffect(() => {
    if (!authChecked) return;

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
  }, [authChecked]);

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

  // ロールチェック中は軽くプレースホルダだけ出す
  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm text-slate-400">認証情報を確認しています...</p>
        </div>
      </main>
    );
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
