// app/api/mock-orders/route.ts
import { NextResponse } from 'next/server';
import { MOCK_PRODUCTS, MockProduct } from '../mock-products/route';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

type MockOrderStatus = 'pending' | 'shipped' | 'canceled';

type MockOrder = {
  id: string;
  orderNumber: string;
  product: MockProduct;
  quantity: number; // セット数（シート数）
  subtotalExTax: number;
  taxAmount: number;
  totalAmount: number;
  status: MockOrderStatus;
  createdAt: string; // ISO

  // 送り先情報（v1 では1件分のみ）
  shippingPostalAndAddress: string;
  shippingRecipientName: string;
  shippingPhoneNumber: string;
  shippingDeliveryDate: string;
  shippingDeliveryTimeNote: string;
};

// メモリ上の「なんちゃってDB」
let ORDERS: MockOrder[] = [];

// メールモード
type MailMode = 'disabled' | 'test' | 'production';

function getMailMode(): MailMode {
  const raw = process.env.ORDER_MAIL_MODE;
  if (raw === 'production' || raw === 'test' || raw === 'disabled') {
    return raw;
  }
  // 何も設定されていなければ安全側に倒す
  return 'disabled';
}

// SES クライアント（環境変数が未設定なら undefined のままにしておく）
const ses =
  process.env.AWS_REGION &&
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY
    ? new SESClient({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      })
    : undefined;

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

// 金額フォーマット（カンマ区切り）
function yen(amount: number) {
  return amount.toLocaleString('ja-JP');
}

// メール本文テンプレート（送り先情報つき）
function buildOrderEmailBody(order: MockOrder): string {
  const now = new Date();
  const orderedAt = now.toLocaleString('ja-JP');

  const shippingInfoLines = [
    `郵便番号・住所：`,
    `  ${order.shippingPostalAndAddress || '（未入力）'}`,
    ``,
    `お届け先氏名：`,
    `  ${order.shippingRecipientName || '（未入力）'}`,
    ``,
    `運送会社と連絡が取れる電話番号：`,
    `  ${order.shippingPhoneNumber || '（未入力）'}`,
    ``,
    `ご希望の到着日時：`,
    `  ${
      order.shippingDeliveryDate || order.shippingDeliveryTimeNote
        ? `${order.shippingDeliveryDate ?? ''} ${order.shippingDeliveryTimeNote ?? ''}`.trim()
        : '（未入力）'
    }`,
  ].join('\n');

  return `
（株）グリーンサム 御中

いつもお世話になっております。
下記内容でいちごの新規発注をお願いいたします。
（本メールはシステムからの自動送信です）

────────────────────
【注文情報】
注文ID：${order.orderNumber}
発注日時：${orderedAt}

【商品】
1点目
・商品名：${order.product.name}
・セット数（シート数）：${order.quantity}
・単価：${yen(order.product.unitPrice)}円（税抜）/セット
・小計：${yen(order.subtotalExTax)}円（税抜）

【金額】
・商品小計：${yen(order.subtotalExTax)}円
・消費税：${yen(order.taxAmount)}円
・合計金額：${yen(order.totalAmount)}円（税込）

【お届け先情報】
${shippingInfoLines}

※ 現在は試験運用中です。内容に誤りがないかご確認のうえ、
　ご対応いただけますと幸いです。

【出荷完了後のご返信フォーマット（ご提案）】
お手数ですが、出荷完了後は下記の形式でご返信いただけますと幸いです。

・伝票番号：
・運送会社：
・出荷日：

────────────────────

今後ともよろしくお願いいたします。
`.trim();
}

async function sendOrderEmail(order: MockOrder) {
  const mode = getMailMode();

  if (!ses) {
    console.warn('[ORDER EMAIL] SES client is not configured. Skip sending.');
    return;
  }

  if (mode === 'disabled') {
    console.log('[ORDER EMAIL] Mail mode is disabled. Skip sending.');
    return;
  }

  const from = process.env.SES_FROM_EMAIL;
  const toProd = process.env.ORDER_TO_EMAIL;
  const ccCommon = process.env.ORDER_CC_EMAIL;

  if (!from) {
    console.warn('[ORDER EMAIL] SES_FROM_EMAIL is not set. Skip sending.');
    return;
  }

  let toAddresses: string[] = [];
  const ccAddresses: string[] = [];

  if (mode === 'test') {
    const testTo = ccCommon || from;
    if (!testTo) {
      console.warn(
        '[ORDER EMAIL] No test recipient (ORDER_CC_EMAIL or FROM). Skip sending.'
      );
      return;
    }
    toAddresses = [testTo];
    // テストモードではグリーンサムには送らない
  } else {
    if (!toProd) {
      console.warn(
        '[ORDER EMAIL] ORDER_TO_EMAIL is not set in production mode. Skip sending.'
      );
      return;
    }
    toAddresses = [toProd];
    if (ccCommon) {
      ccAddresses.push(ccCommon);
    }
  }

  let subject = `【いちご新規オーダー】${order.product.name} / ${order.quantity}シート`;
  if (mode === 'test') {
    subject = `[TEST] ${subject}`;
  }

  const command = new SendEmailCommand({
    Source: from,
    Destination: {
      ToAddresses: toAddresses,
      CcAddresses: ccAddresses,
    },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Text: {
          Data: buildOrderEmailBody(order),
          Charset: 'UTF-8',
        },
      },
    },
  });

  try {
    const res = await ses.send(command);
    console.log('[ORDER EMAIL] Sent successfully', {
      MessageId: res.MessageId,
      mode,
      to: toAddresses,
      cc: ccAddresses,
    });
  } catch (err) {
    console.error('[ORDER EMAIL] Failed to send', err);
  }
}

export function GET() {
  return NextResponse.json({ orders: ORDERS });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      productId,
      quantity,
      postalAndAddress,
      recipientName,
      phoneNumber,
      deliveryDate,
      deliveryTimeNote,
    } = body as {
      productId: string;
      quantity: number;
      postalAndAddress?: string;
      recipientName?: string;
      phoneNumber?: string;
      deliveryDate?: string;
      deliveryTimeNote?: string;
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
      shippingPostalAndAddress: postalAndAddress ?? '',
      shippingRecipientName: recipientName ?? '',
      shippingPhoneNumber: phoneNumber ?? '',
      shippingDeliveryDate: deliveryDate ?? '',
      shippingDeliveryTimeNote: deliveryTimeNote ?? '',
    };

    // メモリDBに保存（モック用）
    ORDERS = [order, ...ORDERS];

    // メール送信（失敗しても注文自体は受け付ける）
    await sendOrderEmail(order);

    return NextResponse.json(
      { orderNumber: order.orderNumber },
      { status: 201 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました。' },
      { status: 500 }
    );
  }
}
