// app/api/mock-orders/route.ts
import { NextResponse } from 'next/server';
import { MOCK_PRODUCTS, MockProduct } from '../mock-products/route';

type MockOrderStatus = 'pending' | 'shipped' | 'canceled';

type MockOrder = {
  id: string;
  orderNumber: string;
  product: MockProduct;
  quantity: number; // セット数
  subtotalExTax: number;
  taxAmount: number;
  totalAmount: number;
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
    const body = await req.json();
    const { productId, quantity } = body as {
      productId?: string;
      quantity?: number;
    };

    if (!productId || typeof quantity !== 'number') {
      return NextResponse.json(
        { error: '商品とセット数は必須です。' },
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

    const unitPrice = product.unitPrice;
    const taxRate = product.taxRate;

    const subtotalExTax = unitPrice * quantity;
    const taxAmount = Math.round(subtotalExTax * taxRate);
    const totalAmount = subtotalExTax + taxAmount;

    const order: MockOrder = {
      id: crypto.randomUUID(),
      orderNumber: generateOrderNumber(),
      product,
      quantity,
      subtotalExTax,
      taxAmount,
      totalAmount,
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
