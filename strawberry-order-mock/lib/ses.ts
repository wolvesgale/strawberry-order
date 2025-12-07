// lib/ses.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const REGION = process.env.AWS_REGION || "ap-northeast-1";
const FROM = process.env.SES_FROM_EMAIL;
const ORDER_TO = process.env.ORDER_TO_EMAIL;
const ORDER_CC_EMAIL = process.env.ORDER_CC_EMAIL;

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
  to?: string;
  cc?: string[];
};

export async function sendOrderEmail({
  subject,
  bodyText,
  to,
  cc,
}: OrderEmailPayload): Promise<void> {
  const resolvedTo = to ?? ORDER_TO;

  // ここで環境を全部ログに出す
  console.log("[SES] sendOrderEmail env", {
    REGION,
    FROM,
    ORDER_TO,
    ORDER_CC_EMAIL,
    resolvedTo,
  });

  if (!FROM || !REGION) {
    console.warn("[SES] Missing FROM or REGION. Skip sending email.");
    return;
  }

  if (!resolvedTo) {
    console.warn(
      "[SES] No recipient specified (ORDER_TO_EMAIL not set, and no 'to' provided). Skipping send."
    );
    return;
  }

  const ccAddresses: string[] = [];

  if (ORDER_CC_EMAIL) {
    ccAddresses.push(ORDER_CC_EMAIL);
  }
  if (cc && cc.length > 0) {
    ccAddresses.push(...cc);
  }

  console.log("[SES] Sending email", {
    subject,
    to: resolvedTo,
    ccAddresses,
  });

  const command = new SendEmailCommand({
    Source: FROM,
    Destination: {
      ToAddresses: [resolvedTo],
      CcAddresses: ccAddresses.length > 0 ? ccAddresses : undefined,
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: "UTF-8",
      },
      Body: {
        Text: {
          Data: bodyText,
          Charset: "UTF-8",
        },
      },
    },
  });

  try {
    const resp = await sesClient.send(command);
    console.log("[SES] SendEmail success", resp);
  } catch (err) {
    console.error("[SES SEND ERROR]", err);
    throw err;
  }
}
