import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { STSClient, AssumeRoleWithWebIdentityCommand } from "@aws-sdk/client-sts";

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

// Vercel OIDC (VERCEL_OIDC_TOKEN + AWS_ROLE_ARN) で STS 一時クレデンシャルを取得する
async function resolveCredentials() {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  const roleArn = process.env.AWS_ROLE_ARN;

  if (oidcToken && roleArn) {
    const sts = new STSClient({ region: REGION });
    const { Credentials } = await sts.send(
      new AssumeRoleWithWebIdentityCommand({
        RoleArn: roleArn,
        RoleSessionName: "vercel-strawberry-order",
        WebIdentityToken: oidcToken,
      })
    );
    if (!Credentials?.AccessKeyId || !Credentials?.SecretAccessKey) {
      throw new Error("[SES] STS AssumeRoleWithWebIdentity: no credentials returned");
    }
    return {
      accessKeyId: Credentials.AccessKeyId,
      secretAccessKey: Credentials.SecretAccessKey,
      sessionToken: Credentials.SessionToken,
    };
  }

  return undefined;
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
    ORDER_CC_RAW,
    resolvedTo,
    resolvedCc: ccDeduped,
    hasOidcToken: !!process.env.VERCEL_OIDC_TOKEN,
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

  const credentials = await resolveCredentials();

  const sesClient = new SESClient({ region: REGION, credentials });

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
