// strawberry-order-mock/app/api/mock-orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PRODUCTS } from "../mock-products/route";

export const runtime = "nodejs";

const ORDER_NUMBER_PREFIX = 'ORD';
const PRICE_TABLE_NATSUAKI: Record<number, number> = {
  20: 1700,
  24: 1600,
  30: 1550,
  36: 1300,
};

type MockOrder = {
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

// メモリ上の「なんちゃってDB」
let ORDERS: MockOrder[] = [];

// ランダムな注文番号生成（あとで本実装時に差し替え）
function generateOrderNumber(createdAtIso: string) {
  const now = new Date(createdAtIso);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePart = `${y}${m}${d}`;

  const sameDayCount = ORDERS.filter(
    (o) => o.createdAt.slice(0, 10) === createdAtIso.slice(0, 10),
  ).length;
  const seq = String(sameDayCount + 1).padStart(4, '0');

  return `${ORDER_NUMBER_PREFIX}-${datePart}-${seq}`;
}

// 本日から 3 日後 0:00
function getMinDeliveryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 注文一覧取得
 */
export async function GET(req: NextRequest) {
  const client = supabaseAdmin;
  if (!client) {
    console.error("[/api/mock-orders GET] supabaseAdmin is null");
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 }
    );
  }

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
        { error: "商品が選択されていません。" },
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

    const PIECES_PER_SHEET_OPTIONS = [36, 30, 24, 20];
    if (
      !piecesPerSheet ||
      !PIECES_PER_SHEET_OPTIONS.includes(Number(piecesPerSheet))
    ) {
      return NextResponse.json(
        { error: "1シートあたりの玉数を選択してください。" },
        { status: 400 }
      );
    }

    if (!postalAndAddress) {
      return NextResponse.json(
        { error: "郵便番号・住所を入力してください。" },
        { status: 400 }
      );
    }
    if (!recipientName) {
      return NextResponse.json(
        { error: "お届け先氏名を入力してください。" },
        { status: 400 }
      );
    }
    if (!phoneNumber) {
      return NextResponse.json(
        { error: "運送会社と連絡が取れる電話番号を入力してください。" },
        { status: 400 }
      );
    }
    if (!deliveryDate) {
      return NextResponse.json(
        { error: "ご希望の到着日を選択してください。" },
        { status: 400 }
      );
    }

    const minDate = getMinDeliveryDate();
    const selectedDate = new Date(deliveryDate);
    if (Number.isNaN(selectedDate.getTime())) {
      return NextResponse.json(
        { error: "到着希望日が正しく入力されていません。" },
        { status: 400 }
      );
    }
    if (selectedDate < minDate) {
      const minStr = minDate.toISOString().slice(0, 10);
      return NextResponse.json(
        { error: `到着希望日は ${minStr} 以降の日付を選択してください。` },
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

    const effectiveUnitPrice =
      product.season === 'summer_autumn'
        ? PRICE_TABLE_NATSUAKI[piecesPerSheet] ?? product.unitPrice
        : product.unitPrice;

    const productForOrder: MockProduct = {
      ...product,
      unitPrice: effectiveUnitPrice,
    };

    const order: MockOrder = {
      id: crypto.randomUUID(),
      orderNumber: generateOrderNumber(createdAtIso),
      product: productForOrder,
      quantity,
      piecesPerSheet,
      deliveryDate,
      deliveryAddress: postalAndAddress,
      agencyName: safeAgencyName,
      createdByEmail: createdByEmail ?? null,
      status: 'pending',
      createdAt: createdAtIso,
    };

    const { id, status, unitPrice, taxRate } = body;

    if (!id) {
      return NextResponse.json(
        { error: "更新対象の注文 ID が指定されていません。" },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: "更新後のステータスが指定されていません。" },
        { status: 400 }
      );
    }

    const allowed: OrderStatus[] = ["pending", "shipped", "canceled"];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: "不正なステータスです。" },
        { status: 400 }
      );
    }

    // 金額再計算（単価/税率が送られてきた場合）
    const updatePayload: any = { status };

    if (typeof unitPrice === "number") {
      updatePayload.unit_price = unitPrice;
    }
    if (typeof taxRate === "number") {
      updatePayload.tax_rate = taxRate;
    }

    if (typeof unitPrice === "number" || typeof taxRate === "number") {
      // いったん現在の quantity を取得して再計算
      const { data: current, error: fetchError } = await client
        .from("orders")
        .select("quantity, unit_price, tax_rate")
        .eq("id", id)
        .single();

      if (fetchError) {
        console.error(
          "[/api/mock-orders PATCH] fetch current order error:",
          fetchError
        );
      } else {
        const q = current.quantity as number;
        const u =
          typeof unitPrice === "number"
            ? unitPrice
            : (current.unit_price as number | null);
        const t =
          typeof taxRate === "number"
            ? taxRate
            : (current.tax_rate as number | null);

        const subtotal =
          u != null ? u * q : null;
        const taxAmount =
          subtotal != null && t != null
            ? Math.round(subtotal * (Number(t) / 100))
            : null;
        const totalAmount =
          subtotal != null && taxAmount != null
            ? subtotal + taxAmount
            : null;

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

    const subject = `いちご発注受付（${safeAgencyName} / ${createdAtDateOnly}）`;

    // 本番ではここでSES等でメール送信する
    console.log('[MOCK EMAIL] 発注メール送信:', {
      to: 'greensum@example.com',
      subject,
      body: mailText,
    });

    return NextResponse.json({ ok: true, order: updated });
  } catch (error: any) {
    console.error("[/api/mock-orders PATCH] Unexpected error:", error);
    return NextResponse.json(
      { error: error?.message ?? "注文ステータス更新中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
