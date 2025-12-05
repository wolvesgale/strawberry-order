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
  /** 明示的に送信先を変えたい場合に指定。未指定なら ORDER_TO_EMAIL を優先 */
  to?: string;
  /** 追加の CC（環境変数の ORDER_CC_EMAIL に加えてマージされる） */
  cc?: string[];
};

export async function sendOrderEmail({
  subject,
  bodyText,
  to,
  cc,
}: OrderEmailPayload): Promise<void> {
  // 環境変数不足の場合は送信せず警告だけ
  if (!FROM || !REGION) {
    console.warn(
      "[SES] Missing FROM or REGION. Skip sending email.",
      { FROM, REGION }
    );
    return;
  }

  // 優先順位: 明示的 to > ORDER_TO_EMAIL
  const resolvedTo = to ?? ORDER_TO;

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

  await sesClient.send(command);
}
