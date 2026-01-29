// lib/ses.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "ap-northeast-1";

// ★ 修正：Vercel 側のキー（SES_FROM_EMAIL）を優先しつつ後方互換も残す
const FROM =
  process.env.SES_FROM_EMAIL ||
  process.env.ORDER_FROM_EMAIL ||
  process.env.ORDER_FROM ||
  process.env.SES_FROM ||
  undefined;

// 受信側（これはログ上すでに取れている）
const ORDER_TO =
  process.env.ORDER_TO_EMAIL ||
  process.env.ORDER_TO ||
  process.env.ORDER_TO_ADDRESS ||
  undefined;

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
  /** 互換用に残しているが、現在の実装では CC 送信は行わない */
  cc?: string[];
};

export async function sendOrderEmail({
  subject,
  bodyText,
  to,
  cc,
}: OrderEmailPayload): Promise<string | null> {
  const resolvedTo = to ?? ORDER_TO;

  console.log("[SES] sendOrderEmail env", {
    REGION,
    FROM,
    ORDER_TO,
    resolvedTo,
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

  if (cc && cc.length > 0) {
    console.warn("[SES] cc is provided but ignored in current configuration:", cc);
  }

  console.log("[SES] Sending email", { subject, to: resolvedTo });

  const command = new SendEmailCommand({
    Source: FROM,
    Destination: {
      ToAddresses: [resolvedTo],
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
