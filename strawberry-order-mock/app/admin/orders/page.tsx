// app/admin/orders/page.tsx
'use client';

import { useEffect, useState } from 'react';

type Order = {
  id: string;
  orderNumber: string;
  product: {
    name: string;
    season: string;
    unitPrice: number;
  };
  quantity: number;
  subtotalExTax: number;
  taxAmount: number;
  totalAmount: number;
  status: 'pending' | 'shipped' | 'canceled';
  createdAt: string;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/mock-orders');
      const data = await res.json();
      setOrders(data.orders);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">注文一覧（モック）</h1>
            <p className="text-xs text-slate-600">
              /order から発注したテストデータがここに一覧で表示されます。
            </p>
          </div>
          <a
            href="/order"
            className="text-xs text-slate-600 underline hover:text-slate-900"
          >
            発注フォームへ
          </a>
        </header>

        {loading ? (
          <p className="text-sm text-slate-600">読み込み中...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-600">
            まだ注文がありません。/order からテスト発注してみてください。
          </p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left px-3 py-2">注文ID</th>
                  <th className="text-left px-3 py-2">商品</th>
                  <th className="text-right px-3 py-2">セット数</th>
                  <th className="text-right px-3 py-2">小計</th>
                  <th className="text-right px-3 py-2">税額</th>
                  <th className="text-right px-3 py-2">合計</th>
                  <th className="text-left px-3 py-2">ステータス</th>
                  <th className="text-left px-3 py-2">受付日時</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-[10px]">
                      {o.orderNumber}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{o.product.name}</div>
                      <div className="text-[10px] text-slate-500">
                        単価: {o.product.unitPrice.toLocaleString()}円
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{o.quantity}</td>
                    <td className="px-3 py-2 text-right">
                      {o.subtotalExTax.toLocaleString()}円
                    </td>
                    <td className="px-3 py-2 text-right">
                      {o.taxAmount.toLocaleString()}円
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {o.totalAmount.toLocaleString()}円
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                        {o.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleString('ja-JP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
