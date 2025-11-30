// app/order/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient"; // パスは位置に合わせて調整

export default function OrderPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setChecking(false);
    }
    check();
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <p>ログイン状態を確認しています...</p>
      </main>
    );
  }

type MockProduct = {
  id: string;
  name: string;
  unitPrice: number;
  taxRate: number;
  season: 'summer' | 'summer-autumn' | 'winter';
};

type OrderState = 'idle' | 'submitting' | 'success' | 'error';

export default function OrderPage() {
  const [products, setProducts] = useState<MockProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(4);

  // 追加した項目
  const [postalAndAddress, setPostalAndAddress] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTimeNote, setDeliveryTimeNote] = useState('');

  const [orderState, setOrderState] = useState<OrderState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      const res = await fetch('/api/mock-products');
      const data = await res.json();
      setProducts(data.products ?? []);
      if (data.products?.length > 0) {
        setSelectedProductId(data.products[0].id);
      }
    };
    fetchProducts();
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;

    setOrderState('submitting');
    setErrorMessage(null);
    setLastOrderNumber(null);

    try {
      const res = await fetch('/api/mock-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: selectedProductId,
          quantity,
          postalAndAddress,
          recipientName,
          phoneNumber,
          deliveryDate,
          deliveryTimeNote,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setOrderState('error');
        setErrorMessage(data.error ?? '発注に失敗しました。');
        return;
      }

      setOrderState('success');
      setLastOrderNumber(data.orderNumber ?? null);
    } catch (err) {
      console.error(err);
      setOrderState('error');
      setErrorMessage('通信エラーが発生しました。');
    }
  };

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-50">
            いちご発注フォーム（モック）
          </h1>
          <p className="text-sm text-slate-400">
            商品とセット数、お届け先情報を入力して発注テストができます。
            メールは現在テストモードで、代理店側のアドレスにのみ送信されます。
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-6 shadow-sm"
        >
          {/* 商品選択 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              商品
            </label>
            <select
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-50 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {selectedProduct && (
              <p className="text-xs text-slate-400">
                単価：{selectedProduct.unitPrice.toLocaleString()}円（税抜） /
                セット　税率：
                {(selectedProduct.taxRate * 100).toFixed(0)}
                %
              </p>
            )}
          </div>

          {/* セット数 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              セット数（シート数）
            </label>
            <input
              type="number"
              min={2}
              step={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-50 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <p className="text-xs text-slate-400">
              ※ 基本は偶数。冬いちごは4の倍数が必要です。
            </p>
          </div>

          <hr className="border-slate-800" />

          {/* 送り先情報 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              送り先郵便番号・住所
            </label>
            <textarea
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-50 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              rows={2}
              placeholder={`例）\n454-0012 名古屋市中川区尾頭橋2-16-11\nクレフラスト尾頭橋101`}
              value={postalAndAddress}
              onChange={(e) => setPostalAndAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              お届け先氏名
            </label>
            <input
              type="text"
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-50 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="例）古田　貴香"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              運送会社と連絡が取れる電話番号
            </label>
            <input
              type="tel"
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-50 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="例）080-6980-4543"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              希望の到着日時
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="date"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-50 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
              <input
                type="text"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-50 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                placeholder="例）午前中 / 14〜16時 など"
                value={deliveryTimeNote}
                onChange={(e) => setDeliveryTimeNote(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-400">
              例）12/2 午前中、12/5 午前中 など。
            </p>
          </div>

          {/* エラー表示 */}
          {orderState === 'error' && errorMessage && (
            <p className="text-sm text-red-400">{errorMessage}</p>
          )}

          {/* 成功メッセージ */}
          {orderState === 'success' && lastOrderNumber && (
            <p className="text-sm text-emerald-400">
              発注を受け付けました。注文ID：{lastOrderNumber}
            </p>
          )}

          <button
            type="submit"
            disabled={orderState === 'submitting'}
            className="w-full mt-2 rounded-md bg-red-600 text-white text-sm font-semibold py-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-red-500 transition"
          >
            {orderState === 'submitting' ? '送信中…' : '発注する（モック）'}
          </button>
        </form>

        <div className="text-right">
          <a
            href="/admin/orders"
            className="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            管理画面（モック）へ
          </a>
        </div>
      </div>
    </main>
  );
}
