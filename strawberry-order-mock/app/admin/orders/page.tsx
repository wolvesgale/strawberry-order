// strawberry-order-mock/app/admin/orders/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export type OrderStatus = "pending" | "sent" | "canceled";

type Order = {
  id: string;
  orderNumber: string;
  productName: string;
  piecesPerSheet: number | null;
  quantity: number;
  deliveryDate: string | null;
  agencyName: string | null;
  agencyId: string | null;
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
  orders: Order[];
};

type PatchResponse =
  | { ok: true; order: Order }
  | { ok: true; deletedId: string };

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "受付",
  sent: "送信済み",
  canceled: "キャンセル",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";

  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  if (!y || !m || !day) return "-";
  return `${y}-${m}-${day}`;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(d)
    .replace(/\//g, "-")
    .replace(",", "");
}

function formatCurrency(value: number | null): string {
  if (value == null) return "-";
  return value.toLocaleString("ja-JP");
}

function normalizeEmail(email: string | null): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function formatShippingFee(quantity: number): string {
  if (quantity <= 40) return "1,410";
  return "個別見積";
}

function calculateDisplayAmounts(order: Order): {
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
} {
  if (order.unitPrice == null) {
    return {
      subtotal: null,
      taxAmount: null,
      totalAmount: null,
    };
  }

  const subtotal = order.unitPrice * order.quantity;
  const taxRate = order.taxRate ?? 0;
  const taxAmount = Math.round(subtotal * (taxRate / 100));
  const totalAmount = subtotal + taxAmount;

  if (
    !Number.isFinite(subtotal) ||
    !Number.isFinite(taxAmount) ||
    !Number.isFinite(totalAmount)
  ) {
    return {
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
    };
  }

  return { subtotal, taxAmount, totalAmount };
}

type SummaryRow = {
  agencyId: string;
  agencyName: string;
  count: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
};

export default function AdminOrdersPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "agency" | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedAgency, setSelectedAgency] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const isAdmin = userRole === "admin";
  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);

  // ★ canceled を画面から除外（要件）
  const visibleOrders = useMemo(() => {
    const base = isAdmin
      ? orders
      : !normalizedEmail
      ? []
      : orders.filter(
          (order) => normalizeEmail(order.createdByEmail) === normalizedEmail
        );

    return base.filter((o) => o.status !== "canceled");
  }, [orders, isAdmin, normalizedEmail]);

  // 代理店フィルタ候補（valueは agencyId、labelは agencyName）
  const agencyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of visibleOrders) {
      const id = o.agencyId ?? "unassigned";
      const label = o.agencyId
        ? o.agencyName ?? o.agencyId
        : "未設定";
      map.set(id, label);
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [visibleOrders]);

  const filteredOrders = useMemo(() => {
    return visibleOrders.filter((order) => {
      const agencyKey = order.agencyId ?? "unassigned";
      const matchesAgency =
        !selectedAgency || selectedAgency === "" || agencyKey === selectedAgency;

      const targetDate = order.deliveryDate ?? order.createdAt;
      const monthKey = String(targetDate).slice(0, 7);
      const matchesMonth =
        !selectedMonth || selectedMonth === "" || monthKey === selectedMonth;

      return matchesAgency && matchesMonth;
    });
  }, [visibleOrders, selectedAgency, selectedMonth]);

  const monthlySummary = useMemo(() => {
    const byAgency = new Map<string, SummaryRow>();
    let totalCount = 0;
    let totalSubtotal = 0;
    let totalTaxAmount = 0;
    let totalAmount = 0;

    filteredOrders.forEach((order) => {
      const agencyId = order.agencyId ?? "unassigned";
      const agencyName = order.agencyId ? order.agencyName ?? order.agencyId : "未設定";
      const displayAmounts = calculateDisplayAmounts(order);
      const subtotal = displayAmounts.subtotal ?? order.subtotal ?? 0;
      const taxAmount = displayAmounts.taxAmount ?? order.taxAmount ?? 0;
      const total = displayAmounts.totalAmount ?? order.totalAmount ?? 0;

      totalCount += 1;
      totalSubtotal += subtotal;
      totalTaxAmount += taxAmount;
      totalAmount += total;

      const current =
        byAgency.get(agencyId) ??
        {
          agencyId,
          agencyName,
          count: 0,
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
        };

      current.count += 1;
      current.subtotal += subtotal;
      current.taxAmount += taxAmount;
      current.totalAmount += total;
      byAgency.set(agencyId, current);
    });

    const rows = Array.from(byAgency.values()).sort((a, b) =>
      a.agencyName.localeCompare(b.agencyName, "ja-JP")
    );

    return {
      monthLabel: selectedMonth || "全期間",
      total: {
        count: totalCount,
        subtotal: totalSubtotal,
        taxAmount: totalTaxAmount,
        totalAmount,
      },
      byAgency: rows,
    };
  }, [filteredOrders, selectedMonth]);

  // 認証 & ロール取得
  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await supabase.auth.getUser();
      if (error) console.error("supabase auth error", error);

      if (!data?.user) {
        router.push("/login");
        return;
      }

      const user = data.user;
      setEmail(user.email ?? null);

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

      setUserRole((profile?.role as "admin" | "agency" | null) ?? null);
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
        const mappedOrders = (json.orders ?? []).map((order) => ({
          ...order,
          agencyId: order.agencyId ?? order.agencyName ?? null,
        }));
        setOrders(mappedOrders);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "注文一覧の取得でエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  async function updateOrder(
    order: Order,
    patch: {
      status?: OrderStatus;
      unitPrice?: number | null;
      taxRate?: number | null;
    }
  ) {
    setSavingId(order.id);
    setError(null);

    try {
      const res = await fetch("/api/mock-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, ...patch }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.error ?? "更新に失敗しました。";
        throw new Error(msg);
      }

      const json = (await res.json()) as PatchResponse;

      // canceled はAPI側で delete → deletedId が返る
      if ("deletedId" in json) {
        setOrders((prev) => prev.filter((o) => o.id !== json.deletedId));
        return;
      }

      const updated: Order = json.order;
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "更新中にエラーが発生しました。");
    } finally {
      setSavingId(null);
    }
  }

  function handleStatusChange(id: string, value: string) {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: value as OrderStatus } : o))
    );
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

  function handleSave(order: Order) {
    updateOrder(order, {
      status: order.status,
      unitPrice: order.unitPrice ?? null,
      taxRate: order.taxRate ?? null,
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const rows = isAdmin ? filteredOrders : visibleOrders;
  const rowsForDisplay = useMemo(
    () =>
      rows.map((order) => {
        const displayAmounts = calculateDisplayAmounts(order);
        return {
          ...order,
          displaySubtotal: displayAmounts.subtotal,
          displayTaxAmount: displayAmounts.taxAmount,
          displayTotalAmount: displayAmounts.totalAmount,
        };
      }),
    [rows]
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              注文一覧{isAdmin ? "（管理者用）" : ""}
            </h1>
            <p className="text-sm text-slate-400">
              代理店経由で登録された発注が一覧で表示されます。
            </p>
            <p className="mt-1 text-xs text-slate-500">
              ログインメール：{email ?? "未ログイン"}（ロール：{userRole ?? "-"}）
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Link
                href="/admin/users"
                className="rounded-md border border-slate-500 bg-slate-700/10 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-600/30"
              >
                ユーザー管理
              </Link>
            )}
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
              注文一覧（{rows.length}件）
            </h2>
            {loading && <p className="text-xs text-slate-400">読み込み中...</p>}
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-end gap-3 text-xs text-slate-100">
              <label className="space-y-1">
                <span className="block text-slate-300">代理店フィルタ</span>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  value={selectedAgency}
                  onChange={(e) => setSelectedAgency(e.target.value)}
                >
                  <option value="">すべての代理店</option>
                  {agencyOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
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
          )}

          {isAdmin && (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-semibold text-slate-100">
                  月次集計（{monthlySummary.monthLabel}）
                </h2>
                <p className="text-[11px] text-slate-500">
                  ※集計は月フィルタ・代理店フィルタの両方が反映されます
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <p className="text-xs text-slate-400">件数</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">
                    {monthlySummary.total.count.toLocaleString("ja-JP")}件
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <p className="text-xs text-slate-400">小計(税抜)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">
                    {formatCurrency(monthlySummary.total.subtotal)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <p className="text-xs text-slate-400">消費税</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">
                    {formatCurrency(monthlySummary.total.taxAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <p className="text-xs text-slate-400">合計(税込)</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-100">
                    {formatCurrency(monthlySummary.total.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-900/70 text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">代理店</th>
                      <th className="px-3 py-2 text-right">件数</th>
                      <th className="px-3 py-2 text-right">小計(税抜)</th>
                      <th className="px-3 py-2 text-right">消費税</th>
                      <th className="px-3 py-2 text-right">合計(税込)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummary.byAgency.map((row) => (
                      <tr key={row.agencyId} className="border-t border-slate-800">
                        <td className="px-3 py-2 text-slate-100">
                          {row.agencyName}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-200">
                          {row.count.toLocaleString("ja-JP")}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-200">
                          {formatCurrency(row.subtotal)}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-200">
                          {formatCurrency(row.taxAmount)}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-100">
                          {formatCurrency(row.totalAmount)}
                        </td>
                      </tr>
                    ))}
                    {monthlySummary.byAgency.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-4 text-center text-[11px] text-slate-500"
                        >
                          対象月の注文がありません。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80 border-b border-slate-800">
                <tr className="text-xs text-slate-400">
                  <th className="px-4 py-2 text-left">注文ID</th>
                  <th className="px-4 py-2 text-left">商品</th>
                  <th className="px-4 py-2 text-center">玉数/シート</th>
                  <th className="px-4 py-2 text-center">セット数</th>
                  <th className="px-4 py-2 text-right">送料</th>
                  <th className="px-4 py-2 text-center">到着希望日</th>
                  <th className="px-4 py-2 text-center">代理店</th>
                  <th className="px-4 py-2 text-right">単価</th>
                  <th className="px-4 py-2 text-right">税率(%)</th>
                  <th className="px-4 py-2 text-right">小計(税抜)</th>
                  <th className="px-4 py-2 text-right">消費税</th>
                  <th className="px-4 py-2 text-right">合計(税込)</th>
                  <th className="px-4 py-2 text-center">ステータス</th>
                  <th className="px-4 py-2 text-center">受付日時</th>
                  <th className="px-4 py-2 text-center">操作</th>
                </tr>
              </thead>

              <tbody>
                {rowsForDisplay.map((order) => {
                  // ★ 管理者は常にステータス変更可能（送信済み限定を撤廃）
                  const statusSelectable = isAdmin;
                  const inputsDisabled = !isAdmin; // canceled は画面に出さないので判定不要

                  return (
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
                        {order.piecesPerSheet != null ? `${order.piecesPerSheet}玉` : "-"}
                      </td>
                      <td className="px-4 py-2 text-center text-xs text-slate-100">
                        {order.quantity}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-slate-100">
                        {formatShippingFee(order.quantity)}
                      </td>
                      <td className="px-4 py-2 text-center text-xs text-slate-100">
                        {formatDate(order.deliveryDate)}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-100">
                        {order.agencyId ? order.agencyName ?? "代理店名未設定" : "未設定"}
                      </td>

                      <td className="px-4 py-2 text-right text-xs text-slate-100">
                        <input
                          type="number"
                          className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                          value={order.unitPrice ?? ""}
                          onChange={(e) => handleUnitPriceChange(order.id, e.target.value)}
                          disabled={inputsDisabled}
                        />
                      </td>

                      <td className="px-4 py-2 text-right text-xs text-slate-100">
                        <input
                          type="number"
                          className="w-16 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                          value={order.taxRate ?? ""}
                          onChange={(e) => handleTaxRateChange(order.id, e.target.value)}
                          disabled={inputsDisabled}
                        />
                      </td>

                      <td className="px-4 py-2 text-right text-xs text-slate-100">
                        {formatCurrency(order.displaySubtotal)}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-slate-100">
                        {formatCurrency(order.displayTaxAmount)}
                      </td>
                      <td className="px-4 py-2 text-right text-emerald-100 font-semibold text-xs">
                        {formatCurrency(order.displayTotalAmount)}
                      </td>

                      <td className="px-4 py-2 text-center text-xs text-slate-100">
                        {isAdmin ? (
                          <select
                            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            disabled={!statusSelectable}
                          >
                            <option value="pending">{STATUS_LABELS.pending}</option>
                            <option value="sent">{STATUS_LABELS.sent}</option>
                            {/* ★ canceled を選んで保存すると API 側で delete → 一覧から消える */}
                            <option value="canceled">{STATUS_LABELS.canceled}</option>
                          </select>
                        ) : (
                          <span>{STATUS_LABELS[order.status]}</span>
                        )}
                      </td>

                      <td className="px-4 py-2 text-center text-xs text-slate-400 whitespace-nowrap">
                        {formatDateTime(order.createdAt)}
                      </td>

                      <td className="px-4 py-2 text-center text-xs text-slate-100">
                        {isAdmin && (
                          <button
                            onClick={() => handleSave(order)}
                            className="rounded-md border border-emerald-500 bg-emerald-600/10 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60"
                            disabled={savingId === order.id}
                          >
                            保存
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {rowsForDisplay.length === 0 && !loading && (
                  <tr>
                    <td colSpan={15} className="px-4 py-8 text-center text-xs text-slate-500">
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
