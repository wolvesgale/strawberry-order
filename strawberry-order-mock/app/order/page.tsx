// app/order/page.tsx
"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

type MockProduct = {
  id: string;
  name: string;
  season: "summer" | "winter";
  unitPrice: number;
  taxRate: number;
};

type OrderState = "idle" | "submitting" | "success" | "error";

type ShippingForm = {
  postalAndAddress: string;
  recipientName: string;
  phoneNumber: string;
  deliveryDate: string;
  deliveryTimeNote: string;
};

export default function OrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(2);
  const [piecesPerSheet, setPiecesPerSheet] = useState<number>(36);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session: { user?: { email?: string } } | null = null;

  // 商品一覧取得
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/mock-products", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("商品一覧の取得に失敗しました。");
        }
        const json = await res.json();
        const list = (json.products ?? []) as MockProduct[];
        setProducts(list);
        if (list.length > 0) {
          setSelectedProductId(list[0].id);
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "商品一覧の取得に失敗しました。");
      }
    }

    fetchProducts();
  }, []);

  const today = new Date();
  const minDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 3,
  );
  const minDateStr = minDate.toISOString().slice(0, 10);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!selectedProductId) {
      setError("商品を選択してください。");
      return;
    }

    if (quantity <= 0 || quantity % 2 !== 0) {
      setError("セット数は1以上の偶数で入力してください。");
      return;
    }

    if (selectedProduct?.season === "winter" && quantity % 4 !== 0) {
      setError("冬いちごは4の倍数で発注してください。");
      return;
    }

    setError(null);
    setOrderState("submitting");
    setOrderNumber(null);

    try {
      const selectedDate = new Date(deliveryDate);

      if (!deliveryDate || selectedDate < minDate) {
        setError('到着希望日は本日から3日後以降の日付を選択してください。');
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/mock-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          quantity,
          piecesPerSheet,
          deliveryDate,
          deliveryAddress,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "発注に失敗しました。");
      }

    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <header className="space-y-2 sm:flex sm:items-start sm:justify-between sm:space-y-0">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                いちご発注フォーム（代理店用）
              </h1>
              <p className="text-sm text-slate-400">
                グリーンサム向けのいちご発注を登録します。
              </p>
              <p className="mt-1 text-xs text-slate-500">
                ログインメール：{session?.user?.email ?? '未ログイン'}
              </p>
              <Link
                href="/admin/orders"
                className="mt-2 inline-flex items-center text-xs text-emerald-300 hover:text-emerald-200 underline underline-offset-4"
              >
                管理画面（モック）へ
              </Link>
            </div>

            {message && (
              <p className="mt-3 sm:mt-0 text-xs sm:text-sm text-emerald-100 bg-emerald-900/40 border border-emerald-700 rounded-md px-3 py-2 max-w-xs">
                {message}
              </p>
            )}
          </header>

          {error && (
            <p className="text-sm text-red-100 bg-red-900/40 border border-red-700 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg"
          >
          <div>
            <label className="block mb-1 text-sm font-medium text-slate-100">
              商品
            </label>
            <select
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              玉数（1シートあたり）<span className="ml-1 text-rose-400">必須</span>
            </label>
            <select
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              value={piecesPerSheet}
              onChange={(e) => setPiecesPerSheet(Number(e.target.value))}
              required
            >
              <option value={36}>36玉</option>
              <option value={30}>30玉</option>
              <option value={24}>24玉</option>
              <option value={20}>20玉</option>
            </select>
            <p className="text-xs text-slate-400">
              1シートあたりの玉数を選択してください。
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              玉数（1シートあたり）<span className="ml-1 text-rose-400">必須</span>
            </label>
            <select
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              value={piecesPerSheet}
              onChange={(e) => setPiecesPerSheet(Number(e.target.value))}
              required
            >
              <option value={36}>36玉</option>
              <option value={30}>30玉</option>
              <option value={24}>24玉</option>
              <option value={20}>20玉</option>
            </select>
            <p className="text-xs text-slate-400">
              1シートあたりの玉数を選択してください。
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              玉数（1シートあたり）<span className="ml-1 text-rose-400">必須</span>
            </label>
            <select
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              value={piecesPerSheet}
              onChange={(e) => setPiecesPerSheet(Number(e.target.value))}
              required
            >
              <option value={36}>36玉</option>
              <option value={30}>30玉</option>
              <option value={24}>24玉</option>
              <option value={20}>20玉</option>
            </select>
            <p className="text-xs text-slate-400">
              1シートあたりの玉数を選択してください。
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              玉数（1シートあたり）<span className="ml-1 text-rose-400">必須</span>
            </label>
            <select
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              value={piecesPerSheet}
              onChange={(e) => setPiecesPerSheet(Number(e.target.value))}
              required
            >
              <option value={36}>36玉</option>
              <option value={30}>30玉</option>
              <option value={24}>24玉</option>
              <option value={20}>20玉</option>
            </select>
            <p className="text-xs text-slate-400">
              1シートあたりの玉数を選択してください。
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              玉数（1シートあたり）<span className="ml-1 text-rose-400">必須</span>
            </label>
            <select
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              value={piecesPerSheet}
              onChange={(e) => setPiecesPerSheet(Number(e.target.value))}
              required
            >
              <option value={36}>36玉</option>
              <option value={30}>30玉</option>
              <option value={24}>24玉</option>
              <option value={20}>20玉</option>
            </select>
            <p className="text-xs text-slate-400">
              1シートあたりの玉数を選択してください。
            </p>
          </div>

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <label className="block mb-1 text-sm font-medium text-slate-100">
              セット数
            </label>
            <input
              type="number"
              min={2}
              step={2}
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-slate-400">
              ※ 基本は偶数。冬いちごは4の倍数が必要です。
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              到着希望日<span className="ml-1 text-rose-400">必須</span>
            </label>
            <input
              type="date"
              min={minDateStr}
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              required
            />
            <p className="text-xs text-slate-400">
              本日から3日後以降の日付のみ選択できます。
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              納品先住所<span className="ml-1 text-rose-400">必須</span>
            </label>
            <textarea
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              rows={3}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="例）454-0012 名古屋市中川区XXXXX"
              required
            />
            <p className="text-xs text-slate-400">
              名古屋市以降をマスキングした例です。施設名などもご記入ください。
            </p>
          </div>

          <div className="rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200">
            選択した玉数とセット数で発注します。金額計算は行いません。
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-red-600 text-white text-sm font-semibold py-2 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? '送信中...' : '発注する（モック）'}
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-100 bg-red-900/40 border border-red-700 rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
