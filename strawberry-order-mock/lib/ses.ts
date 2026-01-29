// lib/ses.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "ap-northeast-1";

// Vercel 側のキー（SES_FROM_EMAIL）を優先しつつ後方互換も残す
const FROM =
  process.env.SES_FROM_EMAIL ||
  process.env.ORDER_FROM_EMAIL ||
  process.env.ORDER_FROM ||
  process.env.SES_FROM ||
  undefined;

// To（仕入れ先）
const ORDER_TO =
  process.env.ORDER_TO_EMAIL ||
  process.env.ORDER_TO ||
  process.env.ORDER_TO_ADDRESS ||
  undefined;

// ★追加：CC（Vercel で設定している想定のキーを優先しつつ後方互換）
const ORDER_CC_RAW =
  process.env.ORDER_CC_EMAIL ||
  process.env.ORDER_CC ||
  process.env.ORDER_CC_ADDRESS ||
  process.env.ORDER_CC_ADDRESSES ||
  process.env.ORDER_CC_EMAILS ||
  undefined;

// "a@x.com,b@y.com" / "a@x.com b@y.com" / 改行区切りなどを許容
function parseEmailList(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const DEFAULT_CC = parseEmailList(ORDER_CC_RAW);

const sesClient = new SESClient({
  region: REGION,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

export type OrderEmailPayload = {
  subject: string;
  bodyText: string;
  /** 仕入れ先を個別指定したい場合だけ使用。通常は環境変数 ORDER_TO_EMAIL を使用 */
  to?: string;
  /** CC 宛先（指定があれば env より優先） */
  cc?: string[];
};

export async function sendOrderEmail({
  subject,
  bodyText,
  to,
  cc,
}: OrderEmailPayload): Promise<string | null> {
  const resolvedTo = to ?? ORDER_TO;

  // cc が渡されていればそれを優先。なければ env の DEFAULT_CC を使用
  const resolvedCc = (cc && cc.length > 0 ? cc : DEFAULT_CC)
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0);

  // To と CC の重複排除（同一アドレスが両方に入るのを避ける）
  const ccDeduped = resolvedTo
    ? resolvedCc.filter((addr) => addr !== resolvedTo)
    : resolvedCc;

  console.log("[SES] sendOrderEmail env", {
    REGION,
    FROM,
    ORDER_TO,
    ORDER_CC_RAW,
    resolvedTo,
    resolvedCc: ccDeduped,
  });

  if (!REGION || !FROM) {
    console.warn("[SES] Missing FROM or REGION. Skip sending email.");
    return null;
  }

  if (!resolvedTo) {
    console.warn(
      "[SES] No recipient specified (ORDER_TO_EMAIL not set, and no 'to' provided). Skipping send."
    );
    return null;
  }

  console.log("[SES] Sending email", {
    subject,
    to: resolvedTo,
    cc: ccDeduped,
  });

  const command = new SendEmailCommand({
    Source: FROM,
    Destination: {
      ToAddresses: [resolvedTo],
      // ★ここが本命：CC を指定（空なら付けない）
      ...(ccDeduped.length > 0 ? { CcAddresses: ccDeduped } : {}),
    },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Text: { Data: bodyText, Charset: "UTF-8" },
      },
    },
  });

  try {
    const resp = await sesClient.send(command);
    console.log("[SES] SendEmail success", resp);
    return resp?.MessageId ?? null;
  } catch (err) {
    console.error("[SES SEND ERROR]", err);
    throw err;
  }
}
