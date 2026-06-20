"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const SHIPPING_FEE = 1_410;
const SHIPPING_TAX_RATE = 10;
const DEFAULT_PRODUCT_TAX_RATE = 8;

type Order = {
  id: string;
  orderNumber: string;
  productName: string;
  piecesPerSheet: number | null;
  quantity: number;
  deliveryDate: string | null;
  agencyName: string | null;
  agencyId: string | null;
  status: string;
  createdAt: string;
  unitPrice: number | null;
  taxRate: number | null;
};

function formatJpDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 10);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

function toMonthLabel(yyyymm: string): string {
  if (!yyyymm) return "";
  const [y, m] = yyyymm.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function InvoiceContent() {
  const router = useRouter();
  const params = useSearchParams();
  const agencyId = params.get("agencyId") ?? "";
  const agencyName = params.get("agencyName") ?? "(代理店名未設定)";
  const month = params.get("month") ?? "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issueDate] = useState(() => {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
  });

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) { router.push("/login"); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (profile?.role !== "admin") { router.push("/login"); return; }
      await fetchOrders();
    }
    init();
  }, [agencyId, month, router]);

  async function fetchOrders() {
    setLoading(true);
    setError(null);
    try {
      const url = agencyId && agencyId !== "unassigned"
        ? `/api/mock-orders?agencyId=${encodeURIComponent(agencyId)}`
        : "/api/mock-orders";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("注文データの取得に失敗しました。");
      const json = await res.json();
      const allOrders: Order[] = json.orders ?? [];
      const filtered = allOrders.filter((o) => {
        if (o.status === "canceled") return false;
        if (month) {
          const d = (o.deliveryDate ?? o.createdAt ?? "").slice(0, 7);
          if (d !== month) return false;
        }
        return true;
      });
      setOrders(filtered);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    let productSubtotal = 0;
    let productTax = 0;
    let shippingSubtotal = 0;
    let shippingTax = 0;

    for (const o of orders) {
      const price = o.unitPrice ?? 0;
      const rate = o.taxRate ?? DEFAULT_PRODUCT_TAX_RATE;
      const sub = price * o.quantity;
      productSubtotal += sub;
      productTax += Math.round(sub * rate / 100);

      if (o.quantity <= 40) {
        shippingSubtotal += SHIPPING_FEE;
        shippingTax += Math.round(SHIPPING_FEE * SHIPPING_TAX_RATE / 100);
      }
    }

    const grandTotal = productSubtotal + productTax + shippingSubtotal + shippingTax;
    return { productSubtotal, productTax, shippingSubtotal, shippingTax, grandTotal };
  }, [orders]);

  const fmt = (n: number) => n.toLocaleString("ja-JP");

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500 text-sm">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* 印刷ボタン（印刷時は非表示） */}
      <div className="print:hidden p-4 bg-slate-100 border-b flex items-center gap-3">
        <button
          onClick={() => window.print()}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          印刷する
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-md border border-slate-400 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          閉じる
        </button>
        <span className="text-xs text-slate-500">
          ブラウザの印刷設定でページのヘッダー・フッターを非表示にすることを推奨します。
        </span>
      </div>

      {/* 請求書本体 */}
      <div className="max-w-3xl mx-auto px-8 py-10 space-y-6 print:px-6 print:py-6">
        {/* タイトル */}
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold tracking-widest">請　求　書</h1>
          <div className="text-right text-sm space-y-0.5 text-gray-600">
            <p>発行日：{issueDate}</p>
            {month && <p>請求期間：{toMonthLabel(month)}</p>}
          </div>
        </div>

        {/* 宛先 */}
        <div className="border-b border-gray-300 pb-4">
          <p className="text-lg font-semibold">{agencyName}　御中</p>
        </div>

        {/* 合計金額 */}
        <div className="rounded-lg border-2 border-gray-800 p-4 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-600">ご請求金額（税込）</p>
          <p className="text-2xl font-bold">¥{fmt(summary.grandTotal)}</p>
        </div>

        {/* 注文明細 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">注文明細</h2>
          <table className="w-full text-xs border border-gray-300 border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-2 py-1.5 text-left">発送希望日</th>
                <th className="border border-gray-300 px-2 py-1.5 text-left">内容</th>
                <th className="border border-gray-300 px-2 py-1.5 text-center">数量</th>
                <th className="border border-gray-300 px-2 py-1.5 text-right">単価（税抜）</th>
                <th className="border border-gray-300 px-2 py-1.5 text-right">税率</th>
                <th className="border border-gray-300 px-2 py-1.5 text-right">金額（税抜）</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const price = o.unitPrice ?? 0;
                const rate = o.taxRate ?? DEFAULT_PRODUCT_TAX_RATE;
                const sub = price * o.quantity;
                const hasStdShipping = o.quantity <= 40;
                return (
                  <>
                    <tr key={`${o.id}-product`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-2 py-1.5" rowSpan={hasStdShipping ? 2 : 1}>
                        {formatJpDate(o.deliveryDate)}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5">
                        {o.productName}
                        {o.piecesPerSheet != null ? `　${o.piecesPerSheet}玉` : ""}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-center">
                        {o.quantity}シート
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">
                        {price > 0 ? `¥${fmt(price)}` : "-"}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right text-orange-600">
                        {rate}%
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">
                        {price > 0 ? `¥${fmt(sub)}` : "-"}
                      </td>
                    </tr>
                    {hasStdShipping && (
                      <tr key={`${o.id}-shipping`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="border border-gray-300 px-2 py-1.5 text-gray-500">送料</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-500">1</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right text-gray-500">
                          ¥{fmt(SHIPPING_FEE)}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right text-blue-600">
                          {SHIPPING_TAX_RATE}%
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right text-gray-500">
                          ¥{fmt(SHIPPING_FEE)}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="border border-gray-300 px-2 py-4 text-center text-gray-400">
                    対象の注文がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 税額集計 */}
        <div className="flex justify-end">
          <table className="text-sm border border-gray-300 border-collapse">
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-1.5 text-gray-600">商品小計（税抜）</td>
                <td className="border border-gray-300 px-4 py-1.5 text-right">¥{fmt(summary.productSubtotal)}</td>
              </tr>
              <tr className="bg-orange-50">
                <td className="border border-gray-300 px-4 py-1.5 text-gray-600">
                  うち消費税（{DEFAULT_PRODUCT_TAX_RATE}%・軽減税率）
                </td>
                <td className="border border-gray-300 px-4 py-1.5 text-right">¥{fmt(summary.productTax)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-1.5 text-gray-600">送料小計（税抜）</td>
                <td className="border border-gray-300 px-4 py-1.5 text-right">¥{fmt(summary.shippingSubtotal)}</td>
              </tr>
              <tr className="bg-blue-50">
                <td className="border border-gray-300 px-4 py-1.5 text-gray-600">
                  うち消費税（{SHIPPING_TAX_RATE}%）
                </td>
                <td className="border border-gray-300 px-4 py-1.5 text-right">¥{fmt(summary.shippingTax)}</td>
              </tr>
              <tr className="bg-gray-800 text-white">
                <td className="border border-gray-600 px-4 py-2 font-semibold">合計（税込）</td>
                <td className="border border-gray-600 px-4 py-2 text-right font-bold text-lg">
                  ¥{fmt(summary.grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 税率凡例 */}
        <div className="text-[10px] text-gray-500 space-y-0.5 border-t pt-3">
          <p>■ 税率について</p>
          <p className="text-orange-600">● いちご（農産物）：消費税 {DEFAULT_PRODUCT_TAX_RATE}%（軽減税率対象）</p>
          <p className="text-blue-600">● 送　料：消費税 {SHIPPING_TAX_RATE}%（標準税率）</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <p className="text-gray-500 text-sm">読み込み中...</p>
        </div>
      }
    >
      <InvoiceContent />
    </Suspense>
  );
}
