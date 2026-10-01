import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { awsCredentialsProvider } from "@vercel/functions/oidc";

const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "ap-northeast-1";

const FROM =
  process.env.SES_FROM_EMAIL ||
  process.env.ORDER_FROM_EMAIL ||
  process.env.ORDER_FROM ||
  process.env.SES_FROM ||
  undefined;

const ORDER_TO =
  process.env.ORDER_TO_EMAIL ||
  process.env.ORDER_TO ||
  process.env.ORDER_TO_ADDRESS ||
  undefined;

const ORDER_CC_RAW =
  process.env.ORDER_CC_EMAIL ||
  process.env.ORDER_CC ||
  process.env.ORDER_CC_ADDRESS ||
  process.env.ORDER_CC_ADDRESSES ||
  process.env.ORDER_CC_EMAILS ||
  undefined;

function parseEmailList(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const DEFAULT_CC = parseEmailList(ORDER_CC_RAW);

function buildSESClient() {
  const roleArn = process.env.AWS_ROLE_ARN;

  // Vercel OIDC (awsCredentialsProvider) を優先、なければ静的キー、なければデフォルトチェーン
  if (roleArn) {
    return new SESClient({
      region: REGION,
      credentials: awsCredentialsProvider({ roleArn }),
    });
  }

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return new SESClient({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  return new SESClient({ region: REGION });
}

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
}: OrderEmailPayload): Promise<string | null> {
  const resolvedTo = to ?? ORDER_TO;

  const resolvedCc = (cc && cc.length > 0 ? cc : DEFAULT_CC)
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0);

  const ccDeduped = resolvedTo
    ? resolvedCc.filter((addr) => addr !== resolvedTo)
    : resolvedCc;

  console.log("[SES] sendOrderEmail env", {
    REGION,
    FROM,
    ORDER_TO,
    resolvedTo,
    resolvedCc: ccDeduped,
    hasRoleArn: !!process.env.AWS_ROLE_ARN,
  });

  if (!REGION || !FROM) {
    console.warn("[SES] Missing FROM or REGION. Skip sending email.");
    return null;
  }

  if (!resolvedTo) {
    console.warn("[SES] No recipient specified. Skipping send.");
    return null;
  }

  const sesClient = buildSESClient();

  const command = new SendEmailCommand({
    Source: FROM,
    Destination: {
      ToAddresses: [resolvedTo],
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
