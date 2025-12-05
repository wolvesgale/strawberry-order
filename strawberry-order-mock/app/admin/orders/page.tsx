// app/order/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
// ここを修正
import { supabase } from "@/lib/supabaseClient";

type Season = "summer" | "autumn" | "winter";

type MockProduct = {
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
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [role] = useState<'admin' | 'agency'>('admin');

  // ログインユーザーの代理店情報取得
  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("supabase.auth.getUser error", error);
        return;
      }
      if (!data?.user) return;

      const email = data.user.email ?? "";
      setUserEmail(email);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("agency_name")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("loadProfile error", profileError);
        return;
      }

      if (profile?.agency_name) {
        setAgencyName(profile.agency_name);
      }
    }

    loadProfile();
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setErrorMessage("商品を選択してください。");
      return;
    }

    setOrderState("submitting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/mock-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: selectedProductId,
          quantity,
          postalAndAddress,
          recipientName,
          phoneNumber,
          deliveryDate,
          deliveryTimeNote,
          agencyName: agencyName || null,
          createdByEmail: userEmail || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg = json.error || "発注に失敗しました。";
        throw new Error(msg);
      }

      const json = await res.json();
      console.log("order created", json);

      setOrderState("success");
    } catch (e: any) {
      console.error(e);
      setOrderState("error");
      setErrorMessage(e.message ?? "発注に失敗しました。");
    }
  };

  const resetForm = () => {
    setQuantity(4);
    setPostalAndAddress("");
    setRecipientName("");
    setPhoneNumber("");
    setDeliveryDate("");
    setDeliveryTimeNote("");
    setOrderState("idle");
    setErrorMessage(null);
  };

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-50">注文一覧（モック）</h1>
            <p className="text-xs text-slate-400">
              /order から発注したテストデータがここに一覧で表示されます。
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
              </tbody>
            </table>
          </div>
        )}

        {orderState === "error" && errorMessage && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-slate-700/80 bg-slate-900/70 p-4"
        >
          {/* 商品選択 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              商品
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.unitPrice.toLocaleString("ja-JP")}円/シート）
                </option>
              ))}
            </select>
            {selectedProduct && (
              <p className="text-xs text-slate-400">
                税率：{Math.round(selectedProduct.taxRate * 100)}%
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
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-400">
              夏〜秋いちご：偶数 / 冬いちご：4の倍数 でお願いします。
            </p>
          </div>

          {/* お届け先情報 */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-100">
                郵便番号・住所
              </label>
              <textarea
                value={postalAndAddress}
                onChange={(e) => setPostalAndAddress(e.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="例）454-0012 名古屋市中川区尾頭橋2-16-11 クレフラスト尾頭橋101"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-100">
                お届け先氏名
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-100">
                運送会社と連絡が取れる電話番号
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="例）080-xxxx-xxxx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-100">
                ご希望の到着日
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-100">
                時間帯などの希望（任意）
              </label>
              <input
                type="text"
                value={deliveryTimeNote}
                onChange={(e) => setDeliveryTimeNote(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="例）午前中指定 / 18時以降 など"
              />
            </div>
          </div>

          {/* 送信ボタン */}
          <div className="pt-4 flex items-center justify-between gap-3">
            <button
              type="submit"
              disabled={orderState === "submitting"}
              className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
            >
              {orderState === "submitting" ? "送信中…" : "この内容で発注する"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-slate-200 underline"
            >
              入力をクリアする
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
