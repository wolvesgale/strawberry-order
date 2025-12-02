// app/order/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Season = "summer" | "autumn" | "winter";

type MockProduct = {
  id: string;
  name: string;
  season: Season;
  unitPrice: number;
  taxRate: number;
};

type OrderState = "idle" | "submitting" | "success" | "error";

export default function OrderPage() {
  const [products, setProducts] = useState<MockProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(4);
  const [postalAndAddress, setPostalAndAddress] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTimeNote, setDeliveryTimeNote] = useState("");
  const [orderState, setOrderState] = useState<OrderState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [agencyName, setAgencyName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  // 商品マスタ取得
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/mock-products");
        if (!res.ok) {
          throw new Error("商品マスタの取得に失敗しました。");
        }
        const json = await res.json();
        const list = (json.products ?? []) as MockProduct[];
        setProducts(list);

        if (list.length > 0) {
          setSelectedProductId(list[0].id);
        }
      } catch (e: any) {
        console.error(e);
        setErrorMessage(e.message ?? "商品マスタ取得時にエラーが発生しました。");
      }
    }

    fetchProducts();
  }, []);

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
    <main className="min-h-screen bg-slate-900 text-slate-100 px-4 py-8">
      <div className="max-w-xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">いちご発注フォーム（代理店用）</h1>
          <p className="text-sm text-slate-400">
            グリーンサム向けのいちご発注を登録します。
          </p>

          <div className="flex flex-wrap gap-2 text-xs text-slate-300 mt-2">
            {agencyName && (
              <span className="inline-flex items-center rounded-full bg-slate-800/80 px-3 py-1">
                代理店：{agencyName}
              </span>
            )}
            {userEmail && (
              <span className="inline-flex items-center rounded-full bg-slate-800/80 px-3 py-1">
                ログインメール：{userEmail}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <a
              href="/agency/orders"
              className="text-xs text-indigo-300 hover:text-indigo-100 underline"
            >
              自分の発注履歴を見る
            </a>
            <a
              href="/admin/orders"
              className="text-xs text-slate-400 hover:text-slate-200 underline"
            >
              （管理者の場合）注文一覧へ
            </a>
          </div>
        </header>

        {orderState === "success" && (
          <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            発注を受付けました。メールが送信されているかご確認ください。
            <button
              type="button"
              onClick={resetForm}
              className="ml-4 inline-flex items-center rounded-md border border-emerald-500/60 px-3 py-1 text-xs hover:bg-emerald-500/20"
            >
              続けて発注する
            </button>
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
