// app/order/page.tsx
'use client';

import { useEffect, useState } from 'react';

type Product = {
  id: string;
  name: string;
  season: 'summer' | 'summer_autumn' | 'winter';
  unitPrice: number;
};

export default function OrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/mock-products');
      const data = await res.json();
      setProducts(data.products);
      if (data.products.length > 0) {
        setProductId(data.products[0].id);
      }
    };
    load();
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/mock-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? '発注に失敗しました。');
      } else {
        setMessage(`ご注文を受け付けました。注文ID：${data.orderNumber}`);
      }
    } catch (err) {
      console.error(err);
      setError('通信エラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            いちご発注フォーム（モック）
          </h1>
          <p className="text-sm text-slate-600">
            商品とセット数だけ入力して発注テストができます。
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl shadow px-4 py-5">
          <div>
            <label className="block mb-1 text-sm font-medium text-slate-800">
              商品
            </label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {selectedProduct && (
              <p className="mt-1 text-xs text-slate-500">
                単価：{selectedProduct.unitPrice.toLocaleString()}円（税抜） / セット
              </p>
            )}
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-slate-800">
              セット数
            </label>
            <input
              type="number"
              min={2}
              step={2}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-slate-500">
              ※ 基本は偶数。冬いちごは4の倍数が必要です。
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-red-600 text-white text-sm font-semibold py-2 disabled:opacity-50"
          >
            {submitting ? '送信中...' : '発注する（モック）'}
          </button>
        </form>

        {message && (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
            {message}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="text-right">
          <a
            href="/admin/orders"
            className="text-xs text-slate-600 underline hover:text-slate-900"
          >
            管理画面（モック）へ
          </a>
        </div>
      </div>
    </main>
  );
}
