"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PriceRecord = {
  id: string;
  product_name: string;
  pieces_per_sheet: number | null;
  unit_price: number;
  tax_rate: number;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
};

type EditState = {
  unit_price: string;
  tax_rate: string;
  effective_from: string;
  effective_to: string;
};

const SHIPPING_FEE = 1_410;
const SHIPPING_TAX_RATE = 10;

export default function AdminPricesPage() {
  const router = useRouter();
  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 追加フォーム
  const [productName, setProductName] = useState("夏秋いちご（章姫）");
  const [piecesPerSheet, setPiecesPerSheet] = useState("");
  const [unitPrice, setUnitPrice] = useState("1150");
  const [taxRate, setTaxRate] = useState("8");
  const [effectiveFrom, setEffectiveFrom] = useState("2026-07-01");
  const [effectiveTo, setEffectiveTo] = useState("2026-07-31");

  // 編集中の行
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    unit_price: "",
    tax_rate: "",
    effective_from: "",
    effective_to: "",
  });

  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) { router.push("/login"); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (profile?.role !== "admin") { router.push("/login"); return; }
      fetchPrices();
    }
    checkAuth();
  }, [router]);

  async function fetchPrices() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/prices");
      if (!res.ok) throw new Error("価格情報の取得に失敗しました。");
      const json = await res.json();
      setPrices(json.prices ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          piecesPerSheet: piecesPerSheet ? Number(piecesPerSheet) : null,
          unitPrice: Number(unitPrice),
          taxRate: Number(taxRate),
          effectiveFrom,
          effectiveTo: effectiveTo || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "登録に失敗しました。");
      }
      const json = await res.json();
      if (json.price) setPrices((prev) => [json.price, ...prev]);
      const label = piecesPerSheet ? `${productName} ${piecesPerSheet}玉` : productName;
      setMessage(`「${label}」の価格を登録しました。`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(p: PriceRecord) {
    setEditingId(p.id);
    setEditState({
      unit_price: String(p.unit_price),
      tax_rate: String(p.tax_rate),
      effective_from: p.effective_from,
      effective_to: p.effective_to ?? "",
    });
  }

  async function handleSave(id: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          unitPrice: Number(editState.unit_price),
          taxRate: Number(editState.tax_rate),
          effectiveFrom: editState.effective_from,
          effectiveTo: editState.effective_to || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "更新に失敗しました。");
      }
      const json = await res.json();
      if (json.price) {
        setPrices((prev) => prev.map((p) => (p.id === id ? json.price : p)));
      }
      setEditingId(null);
      setMessage("価格を更新しました。");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`「${label}」を削除しますか？`)) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/prices?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "削除に失敗しました。");
      }
      setPrices((prev) => prev.filter((p) => p.id !== id));
      setMessage(`「${label}」を削除しました。`);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function formatDate(d: string | null) {
    return d?.slice(0, 10) ?? "-";
  }

  const inputCls = "w-full rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-100 outline-none focus:border-emerald-400";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-50">価格マスタ管理</h1>
            <p className="text-xs text-slate-400">
              商品単価・税率・適用期間を登録します。注文作成時に最新の有効価格が自動適用されます。
            </p>
          </div>
          <Link href="/admin/orders" className="text-xs text-slate-300 underline hover:text-slate-100">
            注文一覧へ戻る
          </Link>
        </header>

        {message && (
          <p className="rounded-md border border-emerald-700 bg-emerald-900/40 px-3 py-2 text-sm text-emerald-100">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-md border border-red-700 bg-red-900/40 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        )}

        {/* 送料情報（固定） */}
        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-slate-100">送料設定（固定）</h2>
          <table className="min-w-full text-xs text-slate-100">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-3 py-2 text-left">内容</th>
                <th className="px-3 py-2 text-right">金額（税抜）</th>
                <th className="px-3 py-2 text-right">税率</th>
                <th className="px-3 py-2 text-right">税額</th>
                <th className="px-3 py-2 text-right">合計（税込）</th>
                <th className="px-3 py-2 text-left">備考</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-800">
                <td className="px-3 py-2 text-slate-200">送料</td>
                <td className="px-3 py-2 text-right">¥{SHIPPING_FEE.toLocaleString("ja-JP")}</td>
                <td className="px-3 py-2 text-right text-amber-300">{SHIPPING_TAX_RATE}%</td>
                <td className="px-3 py-2 text-right">¥{Math.round(SHIPPING_FEE * SHIPPING_TAX_RATE / 100).toLocaleString("ja-JP")}</td>
                <td className="px-3 py-2 text-right text-emerald-200 font-semibold">
                  ¥{(SHIPPING_FEE + Math.round(SHIPPING_FEE * SHIPPING_TAX_RATE / 100)).toLocaleString("ja-JP")}
                </td>
                <td className="px-3 py-2 text-slate-400">40シート以下の場合の一律送料</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 新規価格登録 */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">商品価格を追加</h2>
          <form className="space-y-3" onSubmit={handleAdd}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <label className="text-xs text-slate-200 space-y-1 lg:col-span-2">
                <span className="block">商品名</span>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="例：夏秋いちご（章姫）"
                  required
                />
              </label>
              <label className="text-xs text-slate-200 space-y-1">
                <span className="block">玉数（任意）</span>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  type="number" min={1}
                  value={piecesPerSheet}
                  onChange={(e) => setPiecesPerSheet(e.target.value)}
                  placeholder="例：30"
                />
              </label>
              <label className="text-xs text-slate-200 space-y-1">
                <span className="block">単価（税抜）</span>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  type="number" min={1}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                />
              </label>
              <label className="text-xs text-slate-200 space-y-1">
                <span className="block">税率（%）</span>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  type="number" min={0} max={100}
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  required
                />
                <p className="text-[10px] text-slate-400">いちご 8%</p>
              </label>
              <label className="text-xs text-slate-200 space-y-1">
                <span className="block">適用開始日</span>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  required
                />
              </label>
              <label className="text-xs text-slate-200 space-y-1">
                <span className="block">適用終了日（任意）</span>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                />
                <p className="text-[10px] text-slate-400">空欄 = 期限なし</p>
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? "登録中..." : "登録する"}
              </button>
            </div>
          </form>
        </section>

        {/* 価格一覧 */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">商品価格一覧</h2>
            {loading && <span className="text-xs text-slate-400">読み込み中...</span>}
          </div>

          {prices.length === 0 && !loading ? (
            <p className="text-xs text-slate-400">価格が登録されていません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-slate-100">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left">商品名</th>
                    <th className="px-3 py-2 text-center">玉数</th>
                    <th className="px-3 py-2 text-right">単価（税抜）</th>
                    <th className="px-3 py-2 text-right">税率</th>
                    <th className="px-3 py-2 text-right">税込単価</th>
                    <th className="px-3 py-2 text-left">適用開始日</th>
                    <th className="px-3 py-2 text-left">適用終了日</th>
                    <th className="px-3 py-2 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((p) => {
                    const isEditing = editingId === p.id;
                    const isExpired = p.effective_to && p.effective_to < new Date().toISOString().slice(0, 10);
                    const editedPrice = Number(editState.unit_price);
                    const editedTax = Math.round(editedPrice * Number(editState.tax_rate) / 100);
                    const tax = Math.round(p.unit_price * p.tax_rate / 100);
                    const label = p.pieces_per_sheet != null
                      ? `${p.product_name} ${p.pieces_per_sheet}玉`
                      : p.product_name;

                    if (isEditing) {
                      return (
                        <tr key={p.id} className="border-t border-slate-700 bg-slate-800/60">
                          <td className="px-3 py-2 text-slate-300">{p.product_name}</td>
                          <td className="px-3 py-2 text-center text-slate-300">
                            {p.pieces_per_sheet != null ? `${p.pieces_per_sheet}玉` : "-"}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className={inputCls}
                              type="number" min={1}
                              value={editState.unit_price}
                              onChange={(e) => setEditState((s) => ({ ...s, unit_price: e.target.value }))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className={inputCls}
                              type="number" min={0} max={100}
                              value={editState.tax_rate}
                              onChange={(e) => setEditState((s) => ({ ...s, tax_rate: e.target.value }))}
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-200">
                            {Number.isFinite(editedPrice) ? `¥${(editedPrice + editedTax).toLocaleString("ja-JP")}` : "-"}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className={inputCls}
                              type="date"
                              value={editState.effective_from}
                              onChange={(e) => setEditState((s) => ({ ...s, effective_from: e.target.value }))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className={inputCls}
                              type="date"
                              value={editState.effective_to}
                              onChange={(e) => setEditState((s) => ({ ...s, effective_to: e.target.value }))}
                            />
                          </td>
                          <td className="px-3 py-2 text-center space-x-1">
                            <button
                              onClick={() => handleSave(p.id)}
                              disabled={saving}
                              className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded border border-slate-500 px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                            >
                              取消
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={p.id} className={`border-t border-slate-800 ${isExpired ? "opacity-40" : ""}`}>
                        <td className="px-3 py-2 text-slate-200">{p.product_name}</td>
                        <td className="px-3 py-2 text-center text-slate-300">
                          {p.pieces_per_sheet != null ? `${p.pieces_per_sheet}玉` : "-"}
                        </td>
                        <td className="px-3 py-2 text-right">¥{p.unit_price.toLocaleString("ja-JP")}</td>
                        <td className="px-3 py-2 text-right text-amber-300">{p.tax_rate}%</td>
                        <td className="px-3 py-2 text-right text-emerald-200 font-semibold">
                          ¥{(p.unit_price + tax).toLocaleString("ja-JP")}
                        </td>
                        <td className="px-3 py-2 text-emerald-300">{formatDate(p.effective_from)}〜</td>
                        <td className="px-3 py-2 text-slate-400">
                          {p.effective_to ? formatDate(p.effective_to) : "期限なし"}
                        </td>
                        <td className="px-3 py-2 text-center space-x-1">
                          <button
                            onClick={() => startEdit(p)}
                            className="rounded border border-amber-500 px-2 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/20"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, label)}
                            className="rounded border border-red-500 px-2 py-0.5 text-[10px] font-medium text-red-300 hover:bg-red-500/20"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
