// app/api/mock-orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendOrderEmail } from "@/lib/ses";

export const runtime = "nodejs";

type OrderStatus = "pending" | "shipped" | "canceled";

export type MockOrder = {
  id: string;
  orderNumber: string;
  productName: string;
  piecesPerSheet: number | null;
  quantity: number;
  postalAndAddress: string;
  recipientName: string;
  phoneNumber: string;
  deliveryDate: string | null;
  deliveryTimeNote: string | null;
  agencyName: string | null;
  createdByEmail: string | null;
  status: OrderStatus;
  createdAt: string;
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
    const body = (await request.json()) as any;
    console.log("[MOCK ORDER BODY]", body);

    // ===== いちごの種類（productName） =====
    const rawProduct =
      body.product ??
      body.selectedProduct ??
      body.productId ??
      body.productName ??
      body.strawberryType ??
      body.strawberry;

    let productName = "";

    if (typeof rawProduct === "string") {
      productName = rawProduct.trim();
    } else if (rawProduct && typeof rawProduct === "object") {
      const candidate =
        rawProduct.name ??
        rawProduct.label ??
        rawProduct.text ??
        rawProduct.title ??
        rawProduct.id;

      if (typeof candidate === "string" || typeof candidate === "number") {
        productName = String(candidate).trim();
      }
    }

    if (!productName) {
      productName = "商品名未設定";
    }

    // ===== 1シートあたりの玉数 =====
    const piecesRaw =
      body.piecesPerSheet ??
      body.pieces_per_sheet ??
      body.pieces ??
      body.ballsPerSheet;

    const piecesPerSheet =
      typeof piecesRaw === "number" ? piecesRaw : Number(piecesRaw);

    if (![36, 30, 24, 20].includes(piecesPerSheet)) {
      return NextResponse.json(
        {
          error:
            "1シートあたりの玉数は36玉 / 30玉 / 24玉 / 20玉から選択してください。",
        },
        { status: 400 }
      );
    }

    // ===== セット数（シート数） =====
    const quantityRaw =
      body.quantity ?? body.sheetCount ?? body.sets ?? body.count;
    const quantity =
      typeof quantityRaw === "number" ? quantityRaw : Number(quantityRaw);

    if (!Number.isInteger(quantity) || quantity < 2 || quantity % 2 !== 0) {
      return NextResponse.json(
        { error: "セット数（シート数）は2以上の偶数で入力してください。" },
        { status: 400 }
      );
    }

    // 冬いちごだけ 4 の倍数チェック
    if (productName.includes("冬") && quantity % 4 !== 0) {
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

    const minDate = getMinDeliveryDate();
    if (parsedDelivery < minDate) {
      return NextResponse.json(
        {
          error:
            "到着希望日は本日から3日後以降の日付を選択してください。",
        },
        { status: 400 }
      );
    }

    const deliveryTimeNote =
      typeof body.deliveryTimeNote === "string"
        ? body.deliveryTimeNote.trim()
        : null;

    const agencyName =
      typeof body.agencyName === "string" ? body.agencyName.trim() : null;

    const createdByEmail =
      typeof body.createdByEmail === "string"
        ? body.createdByEmail.trim()
        : null;

    const now = new Date();

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
      postalAndAddress,
      recipientName,
      phoneNumber,
      deliveryDate,
      deliveryTimeNote,
      agencyName,
      createdByEmail,
      status: "pending",
      createdAt: now.toISOString(),
    };

    orders.unshift(order);

    console.log("[MOCK ORDER CREATED]", order);

    // ===== ここからメール送信ロジック =====
    const mailMode = process.env.ORDER_MAIL_MODE ?? "mock";

    const mailTextLines = [
      "いちご発注が登録されました。",
      "",
      `注文番号：${order.orderNumber}`,
      "",
      "【商品情報】",
      `いちごの種類：${order.productName}`,
      `玉数/シート：${order.piecesPerSheet ?? "-"} 玉`,
      `シート数　　：${order.quantity} シート`,
      "",
      "【お届け先】",
      `郵便番号・住所：${order.postalAndAddress}`,
      `お届け先氏名　：${order.recipientName}`,
      `電話番号　　　：${order.phoneNumber}`,
      "",
      "【到着希望】",
      `希望到着日　　：${order.deliveryDate}`,
      `時間帯・メモ　：${order.deliveryTimeNote || "-"}`,
      "",
      "【発注者】",
      `メールアドレス：${order.createdByEmail || "-"}`,
    ];

    const mailText = mailTextLines.join("\n");
    const subject = `【モック】いちご発注受付 (${order.orderNumber})`;

    try {
      if (mailMode === "ses") {
        const fallbackTo = order.createdByEmail ?? undefined;

        await sendOrderEmail({
          subject,
          bodyText: mailText,
          to: fallbackTo,
          cc: [],
        });
      } else {
        console.log("[MOCK ORDER EMAIL]", { subject, mailText });
      }
    } catch (err) {
      console.error("[SES SEND ERROR]", err);
      // メールが失敗しても発注自体は成功扱い
    }

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error("[POST /api/mock-orders] error", error);
    return NextResponse.json(
      { error: "注文の登録中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
