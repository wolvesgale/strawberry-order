// app/order/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";

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
  const [products, setProducts] = useState<MockProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(4);
  const [shipping, setShipping] = useState<ShippingForm>({
    postalAndAddress: "",
    recipientName: "",
    phoneNumber: "",
    deliveryDate: "",
    deliveryTimeNote: "",
  });

  const [orderState, setOrderState] = useState<OrderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

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

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null;

  const handleChangeShipping = (
    field: keyof ShippingForm,
    value: string
  ) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
  };

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
      const res = await fetch("/api/mock-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: selectedProductId,
          quantity,
          postalAndAddress: shipping.postalAndAddress || "（未入力）",
          recipientName: shipping.recipientName || "（未入力）",
          phoneNumber: shipping.phoneNumber || "（未入力）",
          deliveryDate: shipping.deliveryDate || "",
          deliveryTimeNote: shipping.deliveryTimeNote || "",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "発注に失敗しました。");
      }

      setOrderNumber(json.orderNumber ?? null);
      setOrderState("success");
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "発注に失敗しました。");
      setOrderState("error");
    }
  }

  const formattedSubtotal =
    selectedProduct ? selectedProduct.unitPrice * quantity : 0;

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">発注フォーム（モック）</h1>
            <p className="text-sm text-slate-400">
              テスト用の発注フォームです。送信するとSES経由でメールが送信されます。
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            管理画面（モック）へ
          </Link>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {orderState === "success" && orderNumber && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <p className="font-semibold mb-1">発注を受け付けました。</p>
            <p>注文ID：{orderNumber}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-slate-700/80 bg-slate-900/60 p-6"
        >
          {/* 商品 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">商品情報</h2>
            <div className="space-y-2">
              <label className="block text-sm text-slate-300">
                商品<span className="text-red-400 ml-1 text-xs">必須</span>
              </label>
              <select
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（単価: {p.unitPrice.toLocaleString("ja-JP")}円）
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-slate-300">
                セット数（シート数）
                <span className="text-red-400 ml-1 text-xs">必須</span>
              </label>
              <input
                type="number"
                min={1}
                step={2}
                className="w-40 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
              />
              <p className="text-xs text-slate-400">
                基本は偶数。冬いちごは4の倍数での発注をお願いします。
              </p>
            </div>

            {selectedProduct && (
              <div className="rounded-lg border border-slate-700/70 bg-slate-800/60 px-4 py-3 text-sm">
                <p>
                  小計：{formattedSubtotal.toLocaleString("ja-JP")}円（税抜）
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  税率 {Math.round(selectedProduct.taxRate * 100)}% が適用されます。
                </p>
              </div>
            )}
          </section>

          {/* お届け先 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">お届け先情報</h2>

            <div className="space-y-1">
              <label className="block text-sm text-slate-300">
                郵便番号・住所
              </label>
              <textarea
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                rows={2}
                value={shipping.postalAndAddress}
                onChange={(e) =>
                  handleChangeShipping("postalAndAddress", e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm text-slate-300">
                お届け先氏名
              </label>
              <input
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                value={shipping.recipientName}
                onChange={(e) =>
                  handleChangeShipping("recipientName", e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm text-slate-300">
                運送会社と連絡が取れる電話番号
              </label>
              <input
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                value={shipping.phoneNumber}
                onChange={(e) =>
                  handleChangeShipping("phoneNumber", e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm text-slate-300">
                ご希望の納品日
              </label>
              <input
                type="date"
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                value={shipping.deliveryDate}
                onChange={(e) =>
                  handleChangeShipping("deliveryDate", e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm text-slate-300">
                ご希望の時間帯・備考
              </label>
              <textarea
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                rows={2}
                value={shipping.deliveryTimeNote}
                onChange={(e) =>
                  handleChangeShipping("deliveryTimeNote", e.target.value)
                }
              />
            </div>

            <p className="text-xs text-slate-500">
              入力されなかった項目は「（未入力）」としてメール文面に表示されます。
            </p>
          </section>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={orderState === "submitting"}
              className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {orderState === "submitting" ? "送信中…" : "この内容で発注する"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
