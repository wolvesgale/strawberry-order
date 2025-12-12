"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Season = "summer" | "autumn" | "winter";

type MockProduct = {
  id: string;
  name: string;
  season: Season;
  unitPrice: number;
  taxRate: number;
};

const PIECES_PER_SHEET_OPTIONS = [36, 30, 24, 20];

export default function OrderPage() {
  const router = useRouter();

  const [products, setProducts] = useState<MockProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // セット数（シート数）
  const [quantity, setQuantity] = useState<number>(4);
  // 1シートあたりの玉数
  const [piecesPerSheet, setPiecesPerSheet] = useState<number>(36);

  // お届け先情報
  const [postalAndAddress, setPostalAndAddress] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTimeNote, setDeliveryTimeNote] = useState("");

  // 到着希望日の最小日付（本日+3日）
  const [minDeliveryDate, setMinDeliveryDate] = useState("");

  // ログインメール表示用
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  // UI状態
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // min 日付を計算（本日から 3 日後）
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const iso = d.toISOString().slice(0, 10);
    setMinDeliveryDate(iso);
  }, []);

  // 認証チェック & メール取得
  useEffect(() => {
    async function checkAuth() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("supabase auth error", error);
      }
      if (!data?.user) {
        router.push("/login");
        return;
      }
      setSessionEmail(data.user.email ?? null);
    }
    checkAuth();
  }, [router]);

  // 商品一覧取得
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/mock-products", { cache: "no-store" });
        if (!res.ok) throw new Error("商品一覧の取得に失敗しました。");
        const json = await res.json();
        const items = (json.products ?? []) as MockProduct[];
        setProducts(items);
        if (items.length > 0) {
          setSelectedProductId(items[0].id);
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "商品一覧の取得でエラーが発生しました。");
      }
    }
    fetchProducts();
  }, []);

  const selectedProduct =
    products.find((p) => p.id === selectedProductId) ?? null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!selectedProductId) {
      setError("商品を選択してください。");
      return;
    }

    if (!quantity || quantity <= 0 || quantity % 2 !== 0) {
      setError("数量は 1 以上の偶数で入力してください。");
      return;
    }

    if (selectedProduct?.season === "winter" && quantity % 4 !== 0) {
      setError("冬いちごは 4 の倍数で発注してください。");
      return;
    }

    if (!piecesPerSheet || !PIECES_PER_SHEET_OPTIONS.includes(piecesPerSheet)) {
      setError("1シートあたりの玉数を選択してください。");
      return;
    }

    if (!postalAndAddress.trim()) {
      setError("郵便番号・住所を入力してください。");
      return;
    }
    if (!recipientName.trim()) {
      setError("お届け先氏名を入力してください。");
      return;
    }
    if (!phoneNumber.trim()) {
      setError("運送会社と連絡が取れる電話番号を入力してください。");
      return;
    }
    if (!deliveryDate) {
      setError("ご希望の到着日を選択してください。");
      return;
    }
    if (minDeliveryDate) {
      const minDateValue = new Date(minDeliveryDate);
      const selectedDateValue = new Date(deliveryDate);

      if (Number.isNaN(selectedDateValue.getTime())) {
        setError("到着希望日が正しく入力されていません。");
        return;
      }

      if (selectedDateValue < minDateValue) {
        setError(`到着希望日は ${minDeliveryDate} 以降の日付を選択してください。`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/mock-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          quantity,
          piecesPerSheet,
          postalAndAddress,
          recipientName,
          phoneNumber,
          deliveryDate,
          deliveryTimeNote,
          createdByEmail: sessionEmail,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "発注に失敗しました。");
      }

      setMessage(
        "発注を受け付けました。仕入れ先への自動メール送信も完了しています。"
      );

      // 入力値リセット（商品選択だけ維持）
      setQuantity(4);
      setPiecesPerSheet(36);
      setPostalAndAddress("");
      setRecipientName("");
      setPhoneNumber("");
      setDeliveryDate("");
      setDeliveryTimeNote("");
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "発注に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* ヘッダー */}
        <header className="space-y-2 sm:flex sm:items-start sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              いちご発注フォーム（代理店用）
            </h1>
            <p className="text-sm text-slate-400">
              仕入れ先向けのいちご発注を登録します。
            </p>
            <p className="mt-1 text-xs text-slate-500">
              ログインメール：{sessionEmail ?? "未ログイン"}
            </p>
            <Link
              href="/admin/orders"
              className="mt-2 inline-flex items-center text-xs text-emerald-300 hover:text-emerald-200 underline underline-offset-4"
            >
              管理画面へ
            </Link>
          </div>

          {message && (
            <p className="mt-3 sm:mt-0 text-xs sm:text-sm text-emerald-100 bg-emerald-900/40 border border-emerald-700 rounded-md px-3 py-2 max-w-xs">
              {message}
            </p>
          )}
        </header>

        {/* フォーム本体 */}
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg"
        >
          {/* 商品選択 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              いちごの種類
            </label>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 玉数 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              1シートあたりの玉数
            </label>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              value={piecesPerSheet}
              onChange={(e) => setPiecesPerSheet(Number(e.target.value))}
            >
              {PIECES_PER_SHEET_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}玉
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              36玉 / 30玉 / 24玉 / 20玉 から選択します。
            </p>
          </div>

          {/* 数量 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              セット数（シート数）
            </label>
            <input
              type="number"
              min={2}
              step={2}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <p className="text-xs text-slate-500">
              2シート以上の偶数で入力してください。冬いちごは 4 の倍数になります。
            </p>
          </div>

          {/* お届け先情報 */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">
              お届け先情報
            </h2>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-200">
                郵便番号・住所
              </label>
              <textarea
                className="w-full min-h-[72px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={postalAndAddress}
                onChange={(e) => setPostalAndAddress(e.target.value)}
                placeholder={`例）〒123-4567\n愛知県名古屋市XXXXX 1-2-3 XXXXXビル 101`}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-200">
                お届け先氏名
              </label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="例）いちごの香り 古田 様"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-200">
                運送会社と連絡が取れる電話番号
              </label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="例）080-1234-5678"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-200">
                ご希望の到着日
              </label>
              <input
                type="date"
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                min={minDeliveryDate || undefined}
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                本日から 3 日後以降の日付が選択できます。
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-200">
                時間帯などのご希望（任意）
              </label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                value={deliveryTimeNote}
                onChange={(e) => setDeliveryTimeNote(e.target.value)}
                placeholder="例）午前中指定 / 18時以降など"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:hover:bg-emerald-500"
            >
              {submitting ? "送信中..." : "発注する"}
            </button>
          </div>
        </form>

        {/* エラーはフォームの下に表示 */}
        {error && (
          <p className="text-sm text-red-100 bg-red-900/40 border border-red-700 rounded-md px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
