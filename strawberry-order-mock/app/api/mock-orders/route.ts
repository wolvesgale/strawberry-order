// app/api/mock-orders/route.ts
import { NextResponse } from 'next/server';
import { MOCK_PRODUCTS, MockProduct } from '../mock-products/route';

type MockOrderStatus = 'pending' | 'shipped' | 'canceled';

const ORDER_NUMBER_PREFIX = 'ORD';

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

export function GET() {
  return NextResponse.json({ orders: ORDERS });
}

export async function POST(req: Request) {
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
        { error: '商品とセット数は必須です。' },
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
        { error: 'セット数は1以上の偶数で入力してください。' },
        { status: 400 }
      );
    }

    const product = MOCK_PRODUCTS.find((p) => p.id === productId);

    if (!product) {
      return NextResponse.json(
        { error: '商品が見つかりません。' },
        { status: 400 }
      );
    }

    // 冬いちごだけ4の倍数チェック
    if (product.season === 'winter' && quantity % 4 !== 0) {
      return NextResponse.json(
        { error: '冬いちごは4の倍数で発注してください。' },
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
      id: crypto.randomUUID(),
      orderNumber: generateOrderNumber(createdAtIso),
      product,
      quantity,
      piecesPerSheet,
      deliveryDate,
      deliveryAddress: postalAndAddress,
      agencyName: safeAgencyName,
      createdByEmail: createdByEmail ?? null,
      status: 'pending',
      createdAt: createdAtIso,
    };

    ORDERS = [order, ...ORDERS];

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

    return NextResponse.json({ orderNumber: order.orderNumber }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました。' },
      { status: 500 }
    );
  }
}
