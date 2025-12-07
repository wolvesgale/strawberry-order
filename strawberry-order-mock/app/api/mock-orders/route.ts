// app/api/mock-orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendOrderEmail } from "@/lib/ses";

export const runtime = "nodejs";

type OrderStatus = "pending" | "shipped" | "canceled";

export type MockOrder = {
  id: string;
  orderNumber: string;
  product: MockProduct;
  quantity: number; // セット数
  piecesPerSheet: number;
  deliveryDate: string;
  deliveryAddress: string;
  agencyName: string;
  createdByEmail?: string | null;
  status: MockOrderStatus;
  createdAt: string; // ISO
};

// メモリ上に保持するモック注文リスト
const orders: MockOrder[] = [];

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getMinDeliveryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      productId: string;
      quantity: number;
      postalAndAddress: string;
      recipientName: string;
      phoneNumber: string;
      deliveryDate: string;
      deliveryTimeNote: string;
      piecesPerSheet: number;
      agencyName?: string | null;
      createdByEmail?: string | null;
    };

    const {
      productId,
      quantity,
      postalAndAddress,
      recipientName,
      phoneNumber,
      deliveryDate,
      deliveryTimeNote,
      piecesPerSheet,
      agencyName,
      createdByEmail,
    } = body;

    if (!productId || typeof quantity !== 'number') {
      return NextResponse.json(
        { error: "セット数（シート数）は2以上の偶数で入力してください。" },
        { status: 400 }
      );
    }

    if (!piecesPerSheet || !deliveryDate || !postalAndAddress) {
      return NextResponse.json(
        { error: '玉数、到着希望日、納品先住所は必須です。' },
        { status: 400 }
      );
    }

    if (quantity <= 0 || quantity % 2 !== 0) {
      return NextResponse.json(
        { error: "冬いちごは4の倍数で入力してください。" },
        { status: 400 }
      );
    }

    // ===== お届け先情報 =====
    const postalAndAddress =
      typeof body.postalAndAddress === "string"
        ? body.postalAndAddress.trim()
        : "";
    const recipientName =
      typeof body.recipientName === "string"
        ? body.recipientName.trim()
        : "";
    const phoneNumber =
      typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";

    if (!postalAndAddress || !recipientName || !phoneNumber) {
      return NextResponse.json(
        { error: "お届け先情報（住所・氏名・電話番号）を入力してください。" },
        { status: 400 }
      );
    }

    // ===== 到着希望日（3日後以降） =====
    const deliveryDate =
      typeof body.deliveryDate === "string" ? body.deliveryDate : "";

    if (!deliveryDate) {
      return NextResponse.json(
        { error: "ご希望の到着日を選択してください。" },
        { status: 400 }
      );
    }

    const parsedDelivery = new Date(deliveryDate);
    if (Number.isNaN(parsedDelivery.getTime())) {
      return NextResponse.json(
        { error: "到着日の形式が正しくありません。" },
        { status: 400 }
      );
    }

    const today = new Date();
    const minDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 3,
    );
    const selectedDate = new Date(deliveryDate);

    if (selectedDate < minDate) {
      return NextResponse.json(
        { error: '到着希望日は本日から3日後以降の日付を選択してください。' },
        { status: 400 },
      );
    }

    const createdAtDate = new Date();
    const createdAtIso = createdAtDate.toISOString();
    const createdAtDateOnly = !Number.isNaN(createdAtDate.getTime())
      ? createdAtIso.slice(0, 10)
      : '-';
    const safeAgencyName = agencyName?.trim() || '代理店名未設定';

    const order: MockOrder = {
      id: generateId(),
      orderNumber: `MOCK-${now.getFullYear()}${String(
        now.getMonth() + 1
      ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(
        orders.length + 1
      ).padStart(4, "0")}`,
      productName,
      piecesPerSheet,
      quantity,
      piecesPerSheet,
      deliveryDate,
      deliveryAddress: postalAndAddress,
      agencyName: safeAgencyName,
      createdByEmail: createdByEmail ?? null,
      status: 'pending',
      createdAt: createdAtIso,
    };

    orders.unshift(order);

    console.log("[MOCK ORDER CREATED]", order);

    // ===== ここからメール送信ロジック =====
    const mailMode = process.env.ORDER_MAIL_MODE ?? "mock";

    const mailText = `以下の内容で発注を受付しました。\n\n` +
      `注文番号: ${order.orderNumber}\n` +
      `商品: ${product.name}\n` +
      `玉数(1シート): ${piecesPerSheet}玉\n` +
      `セット数: ${quantity}セット\n` +
      `お届け先: ${postalAndAddress}\n` +
      `到着希望日: ${deliveryDate}\n` +
      `時間帯などのご希望: ${deliveryTimeNote || '-'}\n\n` +
      `代理店名: ${safeAgencyName}\n` +
      `発注者メール: ${createdByEmail || '-'}\n` +
      `受付日時: ${createdAtDate.toLocaleString('ja-JP')}\n`;

    const subject = `【モック】いちご発注受付（${safeAgencyName} / ${createdAtDateOnly}）`;

    // 本番ではここでSES等でメール送信する
    console.log('[MOCK EMAIL] 発注メール送信:', {
      to: 'greensum@example.com',
      subject,
      body: mailText,
    });

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error("[POST /api/mock-orders] error", error);
    return NextResponse.json(
      { error: "注文の登録中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
