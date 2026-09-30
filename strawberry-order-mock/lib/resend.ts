// lib/resend.ts
import { Resend } from "resend";

const FROM =
  process.env.RESEND_FROM_EMAIL ||
  process.env.SES_FROM_EMAIL ||
  process.env.ORDER_FROM_EMAIL ||
  undefined;

const ORDER_TO =
  process.env.ORDER_TO_EMAIL ||
  process.env.ORDER_TO ||
  undefined;

const ORDER_CC_RAW =
  process.env.ORDER_CC_EMAIL ||
  process.env.ORDER_CC ||
  process.env.ORDER_CC_ADDRESS ||
  undefined;

function parseEmailList(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const DEFAULT_CC = parseEmailList(ORDER_CC_RAW);

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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Resend] RESEND_API_KEY not set. Skip sending email.");
    return null;
  }
  if (!FROM) {
    console.warn("[Resend] FROM address not set. Skip sending email.");
    return null;
  }

  const resolvedTo = to ?? ORDER_TO;
  if (!resolvedTo) {
    console.warn("[Resend] No recipient specified. Skipping send.");
    return null;
  }

  const resolvedCc = (cc && cc.length > 0 ? cc : DEFAULT_CC)
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0);
  const ccDeduped = resolvedCc.filter((addr) => addr !== resolvedTo);

  console.log("[Resend] sendOrderEmail", { FROM, resolvedTo, ccDeduped });

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [resolvedTo],
      ...(ccDeduped.length > 0 ? { cc: ccDeduped } : {}),
      subject,
      text: bodyText,
    });

    if (error) {
      console.error("[Resend] Send error", error);
      throw new Error(error.message);
    }

    console.log("[Resend] Email sent", data);
    return data?.id ?? null;
  } catch (err) {
    console.error("[Resend] Failed to send email", err);
    throw err;
  }
}
