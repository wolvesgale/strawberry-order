// app/api/mock-orders/route.ts
import { NextResponse } from 'next/server';
import { MOCK_PRODUCTS, MockProduct } from '../mock-products/route';

type MockOrderStatus = 'pending' | 'shipped' | 'canceled';

type MockOrder = {
  id: string;
  orderNumber: string;
  product: MockProduct;
  quantity: number; // セット数
  piecesPerSheet: number;
  deliveryDate: string;
  deliveryAddress: string;
  status: MockOrderStatus;
  createdAt: string; // ISO
};

// メモリ上の「なんちゃってDB」
let ORDERS: MockOrder[] = [];

// ランダムな注文番号生成（あとで本実装時に差し替え）
function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `GS-${y}${m}${d}-${rand}`;
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

    const order: MockOrder = {
      id: crypto.randomUUID(),
      orderNumber: generateOrderNumber(),
      product,
      quantity,
      piecesPerSheet,
      deliveryDate,
      deliveryAddress: postalAndAddress,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    ORDERS = [order, ...ORDERS];

    // 本番ではここでSES等でメール送信する
    console.log('[MOCK EMAIL] 発注メール送信:', {
      to: 'greensum@example.com',
      subject: `【いちご発注】${order.orderNumber} / ${product.name} x ${quantity}セット`,
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
