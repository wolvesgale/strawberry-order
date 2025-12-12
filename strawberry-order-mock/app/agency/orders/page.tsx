'use client';

import { useEffect, useState } from 'react';

function formatCurrency(value?: number | null) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value.toLocaleString('ja-JP')}円`;
  }
  return '-';
}

type Order = {
  id: string;
  orderNumber: string;
  product: {
    name: string;
    unitPrice?: number;
    season: string;
  };
  quantity: number;
  piecesPerSheet: number;
  deliveryDate: string;
  deliveryAddress: string;
  createdAt: string;
};

export default function AgencyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/mock-orders');
      const data = await res.json();
      setOrders(data.orders ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-50">発注履歴（代理店用）</h1>
            <p className="text-xs text-slate-400">
              自身の発注履歴を確認できます。単価は代理店のみ閲覧できます。
            </p>
          </div>
          <a
            href="/order"
            className="text-xs text-slate-300 underline hover:text-slate-100"
          >
            発注フォームへ戻る
          </a>
        </header>

        {loading ? (
          <p className="text-sm text-slate-400">読み込み中...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-400">
            発注履歴はまだありません。発注フォームから新規発注してください。
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {o.product.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      注文番号: {o.orderNumber}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400 whitespace-nowrap">
                    受付: {new Date(o.createdAt).toLocaleString('ja-JP')}
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-100 sm:grid-cols-3">
                  <div className="rounded-md bg-slate-800/60 px-3 py-2">
                    <dt className="text-[10px] text-slate-400">単価</dt>
                    <dd className="font-semibold">{formatCurrency(o.product.unitPrice)}</dd>
                  </div>
                  <div className="rounded-md bg-slate-800/60 px-3 py-2">
                    <dt className="text-[10px] text-slate-400">玉数</dt>
                    <dd className="font-semibold">{o.piecesPerSheet}玉</dd>
                  </div>
                  <div className="rounded-md bg-slate-800/60 px-3 py-2">
                    <dt className="text-[10px] text-slate-400">セット数</dt>
                    <dd className="font-semibold">{o.quantity}</dd>
                  </div>
                </dl>

                <div className="mt-3 text-xs text-slate-300 space-y-1">
                  <div>お届け先: {o.deliveryAddress}</div>
                  <div className="flex items-center gap-2">
                    <span>到着希望日: {o.deliveryDate}</span>
                    <span className="text-[11px] text-slate-500">季節: {o.product.season}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
