// app/api/mock-orders/route.ts
import { NextRequest, NextResponse } from "next/server";

type OrderStatus = "pending" | "shipped" | "canceled";

type MockOrder = {
  id: string;
  orderNumber: string;
  productId: string;
  productName: string;
  piecesPerSheet: number;
  quantity: number;
  postalAndAddress: string;
  recipientName: string;
  phoneNumber: string;
  deliveryDate: string;
  deliveryTimeNote?: string | null;
  agencyName?: string | null;
  createdByEmail?: string | null;
  status: OrderStatus;
  createdAt: string;
};

type PostBody = {
  productId: string;
  productName: string;
  piecesPerSheet: number;
  quantity: number;
  postalAndAddress: string;
  recipientName: string;
  phoneNumber: string;
  deliveryDate: string;
  deliveryTimeNote?: string;
  agencyName?: string | null;
  createdByEmail?: string | null;
};

const ALLOWED_PIECES = [36, 30, 24, 20];

// メモリ上のモック注文データ
let mockOrders: MockOrder[] = [];
let orderSeq = 1;

function generateOrderNumber() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const seq = String(orderSeq++).padStart(3, "0");
  return `ORD-${yyyy}${mm}${dd}-${seq}`;
}

function isValidDeliveryDate(deliveryDate: string): boolean {
  const selected = new Date(deliveryDate);
  if (Number.isNaN(selected.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 3); // 3日後以降

  return selected >= minDate;
}

// GET: 注文一覧（管理画面・代理店画面で使用）
export async function GET() {
  return NextResponse.json({ orders: mockOrders });
}

// POST: 新規注文（モック）
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PostBody;

    const {
      productId,
      productName,
      piecesPerSheet,
      quantity,
      postalAndAddress,
      recipientName,
      phoneNumber,
      deliveryDate,
      deliveryTimeNote,
      agencyName,
      createdByEmail,
    } = body;

    // --- バリデーション ---

    if (!productId || !productName) {
      return NextResponse.json(
        { error: "いちごの種類を選択してください。" },
        { status: 400 }
      );
    }

    if (!ALLOWED_PIECES.includes(piecesPerSheet)) {
      return NextResponse.json(
        {
          error:
            "玉数/シートは 36・30・24・20 のいずれかから選択してください。",
        },
        { status: 400 }
      );
    }

    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return NextResponse.json(
        { error: "シート数は1以上の整数で入力してください。" },
        { status: 400 }
      );
    }

    // 既存仕様：シート数は「偶数」固定
    if (quantity % 2 !== 0) {
      return NextResponse.json(
        { error: "シート数は偶数（2, 4, 6, ...）で入力してください。" },
        { status: 400 }
      );
    }

    if (!postalAndAddress || !postalAndAddress.trim()) {
      return NextResponse.json(
        { error: "お届け先住所を入力してください。" },
        { status: 400 }
      );
    }

    if (!recipientName || !recipientName.trim()) {
      return NextResponse.json(
        { error: "受取人のお名前を入力してください。" },
        { status: 400 }
      );
    }

    if (!phoneNumber || !phoneNumber.trim()) {
      return NextResponse.json(
        { error: "携帯電話番号を入力してください。" },
        { status: 400 }
      );
    }

    if (!deliveryDate) {
      return NextResponse.json(
        { error: "到着希望日を選択してください。" },
        { status: 400 }
      );
    }

    if (!isValidDeliveryDate(deliveryDate)) {
      return NextResponse.json(
        {
          error:
            "到着希望日は本日から3日後以降の日付を選択してください。",
        },
        { status: 400 }
      );
    }

    // --- 注文オブジェクト作成 ---

    const now = new Date();
    const order: MockOrder = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      orderNumber: generateOrderNumber(),
      productId,
      productName,
      piecesPerSheet,
      quantity,
      postalAndAddress: postalAndAddress.trim(),
      recipientName: recipientName.trim(),
      phoneNumber: phoneNumber.trim(),
      deliveryDate,
      deliveryTimeNote: deliveryTimeNote?.trim() || null,
      agencyName: agencyName ?? null,
      createdByEmail: createdByEmail ?? null,
      status: "pending",
      createdAt: now.toISOString(),
    };

    mockOrders.unshift(order);

    // --- モック用ログ（メール送信イメージ）---

    const mailText = `
【モック注文受付のお知らせ】

以下の内容でご注文（モック）が登録されました。

＜ご注文内容＞
・商品：${order.productName}
・玉数/シート：${order.piecesPerSheet}玉
・シート数：${order.quantity}シート

＜お届け先＞
・住所：${order.postalAndAddress}
・お名前：${order.recipientName}
・携帯：${order.phoneNumber}

＜お届け希望＞
・到着希望日：${order.deliveryDate}
・時間帯メモ：${order.deliveryTimeNote ?? "（指定なし）"}

＜代理店・発注者＞
・代理店名：${order.agencyName ?? "（未設定）"}
・発注者メール：${order.createdByEmail ?? "（未設定）"}

※本メールは動作確認用の「モック注文」です。実際の出荷は行われません。
`.trim();

    console.log("[MOCK ORDER EMAIL]", mailText);

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error("[POST /api/mock-orders] error", error);
    return NextResponse.json(
      { error: "注文の登録中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
