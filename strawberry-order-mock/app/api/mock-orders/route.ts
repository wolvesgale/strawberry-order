// strawberry-order-mock/app/api/mock-orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PRODUCTS } from "../mock-products/route";

export const runtime = "nodejs";

export type OrderStatus = "pending" | "sent" | "canceled";

export type MockOrder = {
  id: string;
  orderNumber: string;
  productName: string;
  piecesPerSheet: number | null;
  quantity: number;
  postalAndAddress: string;
  recipientName: string;
  phoneNumber: string;
  deliveryDate: string | null;
  deliveryTimeNote: string | null;
  agencyId: string | null;
  agencyName: string | null;
  createdByEmail: string | null;
  status: OrderStatus;
  createdAt: string;
  productId?: string | null;
  unitPrice?: number | null;
  taxRate?: number | null;
  subtotal?: number | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
};

const ORDER_MAIL_MODE = process.env.ORDER_MAIL_MODE ?? "mock";

const NATSUAKI_STRAWBERRY_PRICES: Record<number, number> = {
  20: 1296,
  24: 1188,
  30: 1080,
  36: 1300,
};
const DEFAULT_TAX_RATE = 10;

function ensureSupabase() {
  if (!supabaseAdmin) {
    console.error(
      "[/api/mock-orders] supabaseAdmin is null. Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."
    );
    return null;
  }
  return supabaseAdmin;
}

async function resolveAgencyLookups(
  client: NonNullable<ReturnType<typeof ensureSupabase>>,
  rows: any[]
): Promise<{
  agencyNameById: Map<string, string>;
  agencyIdByEmail: Map<string, string>;
}> {
  const agencyNameById = new Map<string, string>();
  const agencyIdByEmail = new Map<string, string>();

  const emails = Array.from(
    new Set(
      rows
        .filter((row) => !row.agency_id && !row.agency_name && row.created_by_email)
        .map((row) => row.created_by_email)
    )
  );

  const agencyIds = new Set<string>();
  rows.forEach((row) => {
    if (row.agency_id) agencyIds.add(row.agency_id);
  });

  if (emails.length > 0) {
    const { data: profiles, error: profilesError } = await client
      .from("profiles")
      .select("email, agency_id")
      .in("email", emails);

    if (profilesError) {
      console.error("[/api/mock-orders] profiles lookup error", profilesError);
    } else {
      (profiles ?? []).forEach((profile: any) => {
        if (profile.email && profile.agency_id) {
          agencyIdByEmail.set(profile.email, profile.agency_id);
          agencyIds.add(profile.agency_id);
        }
      });
    }
  }

  if (agencyIds.size > 0) {
    const { data: agencies, error: agenciesError } = await client
      .from("agencies")
      .select("id, name")
      .in("id", Array.from(agencyIds));

    if (agenciesError) {
      console.error("[/api/mock-orders] agencies lookup error", agenciesError);
    } else {
      (agencies ?? []).forEach((agency: any) => {
        if (agency.id && agency.name) {
          agencyNameById.set(agency.id, agency.name);
        }
      });
    }
  }

  return { agencyNameById, agencyIdByEmail };
}

async function resolveAgencySnapshot(
  client: NonNullable<ReturnType<typeof ensureSupabase>>,
  createdByEmail: string | null,
  agencyId: string | null,
  agencyName: string | null
): Promise<{ agencyId: string | null; agencyName: string | null }> {
  if (agencyId || agencyName || !createdByEmail) {
    return { agencyId, agencyName };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("agency_id")
    .eq("email", createdByEmail)
    .maybeSingle();

  if (profileError) {
    console.error("[/api/mock-orders POST] profiles lookup error", profileError);
    return { agencyId, agencyName };
  }

  if (!profile?.agency_id) {
    return { agencyId, agencyName };
  }

  const { data: agency, error: agencyError } = await client
    .from("agencies")
    .select("name")
    .eq("id", profile.agency_id)
    .maybeSingle();

  if (agencyError) {
    console.error("[/api/mock-orders POST] agencies lookup error", agencyError);
  }

  return {
    agencyId: profile.agency_id ?? agencyId,
    agencyName: agency?.name ?? agencyName,
  };
}

function getMinDeliveryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const agencyName = searchParams.get("agencyName");

    let query = client
      .from("orders")
      .select(
        `
        id,
        order_number,
        product_id,
        product_name,
        pieces_per_sheet,
        quantity,
        postal_and_address,
        recipient_name,
        phone_number,
        delivery_date,
        delivery_time_note,
        agency_id,
        agency_name,
        created_by_email,
        status,
        unit_price,
        tax_rate,
        subtotal,
        tax_amount,
        total_amount,
        created_at
      `
      )
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("[/api/mock-orders GET] orders error:", error);
      return NextResponse.json(
        { error: `注文一覧の取得に失敗しました: ${error.message}` },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as any[];
    const { agencyNameById, agencyIdByEmail } = await resolveAgencyLookups(
      client,
      rows
    );

    const orders: MockOrder[] = rows.map((r) => {
      const resolvedAgencyId =
        r.agency_id ??
        (r.created_by_email ? agencyIdByEmail.get(r.created_by_email) : null) ??
        null;
      const resolvedAgencyName =
        r.agency_name ??
        (resolvedAgencyId ? agencyNameById.get(resolvedAgencyId) : null) ??
        null;

      const unitPriceFromMaster =
        r.pieces_per_sheet != null
          ? NATSUAKI_STRAWBERRY_PRICES[r.pieces_per_sheet as number]
          : undefined;

      const unitPrice = r.unit_price ?? unitPriceFromMaster ?? null;
      const taxRate = r.tax_rate ?? DEFAULT_TAX_RATE;
      const rawStatus = r.status as string | null;
      const status: OrderStatus =
        rawStatus === "shipped"
          ? "sent"
          : rawStatus === "sent" || rawStatus === "pending" || rawStatus === "canceled"
          ? rawStatus
          : "pending";

      return {
        id: r.id,
        orderNumber: r.order_number,
        productId: r.product_id ?? null,
        productName: r.product_name ?? "",
        piecesPerSheet: r.pieces_per_sheet ?? null,
        quantity: r.quantity ?? 0,
        postalAndAddress: r.postal_and_address ?? "",
        recipientName: r.recipient_name ?? "",
        phoneNumber: r.phone_number ?? "",
        deliveryDate: r.delivery_date ?? null,
        deliveryTimeNote: r.delivery_time_note ?? null,
        agencyId: resolvedAgencyId,
        agencyName: resolvedAgencyName,
        createdByEmail: r.created_by_email ?? null,
        status,
        createdAt: r.created_at ?? new Date().toISOString(),
        unitPrice,
        taxRate,
        subtotal: r.subtotal ?? null,
        taxAmount: r.tax_amount ?? null,
        totalAmount: r.total_amount ?? null,
      };
    });

    const filteredOrders = agencyName
      ? orders.filter((order) => order.agencyName === agencyName)
      : orders;

    return NextResponse.json({ orders: filteredOrders });
  } catch (error: any) {
    console.error("[/api/mock-orders GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "注文一覧の取得中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = ensureSupabase();
    if (!client) {
      return NextResponse.json(
        { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as any;
    console.log("[/api/mock-orders POST] body:", body);

    const productIdRaw = body.productId ?? body.product_id ?? null;
    const productId =
      typeof productIdRaw === "string" && productIdRaw.trim().length > 0
        ? productIdRaw.trim()
        : null;

    if (!productId) {
      return NextResponse.json(
        { error: "商品が選択されていません。" },
        { status: 400 }
      );
    }

    const rawProduct =
      body.productName ??
      body.product ??
      body.selectedProduct ??
      body.productId ??
      body.strawberryType ??
      body.strawberry;

    let productName = "";
    if (typeof rawProduct === "string") {
      productName = rawProduct.trim();
    } else if (rawProduct && typeof rawProduct === "object") {
      const candidate =
        rawProduct.name ??
        rawProduct.label ??
        rawProduct.text ??
        rawProduct.title ??
        rawProduct.id;
      if (candidate != null) {
        productName = String(candidate).trim();
      }
    }
    if (!productName) {
      productName = "商品名未設定";
    }

    const quantity = Number(body.quantity ?? 0);
    const piecesPerSheet = body.piecesPerSheet ?? body.pieces_per_sheet;
    const postalAndAddress = (
      body.postalAndAddress ??
      body.postal_and_address ??
      ""
    ).trim();
    const recipientName = (body.recipientName ?? body.recipient_name ?? "").trim();
    const phoneNumber = (body.phoneNumber ?? body.phone_number ?? "").trim();
    const deliveryDate = body.deliveryDate ?? null;
    const deliveryTimeNote = body.deliveryTimeNote ?? null;
    const createdByEmail = body.createdByEmail ?? null;
    let agencyId = body.agencyId ?? body.agency_id ?? null;
    let agencyName = body.agencyName ?? body.agency_name ?? null;

    ({ agencyId, agencyName } = await resolveAgencySnapshot(
      client,
      createdByEmail,
      agencyId,
      agencyName
    ));

    if (!quantity || quantity <= 0 || quantity % 2 !== 0) {
      return NextResponse.json(
        { error: "数量は 1 以上の偶数で入力してください。" },
        { status: 400 }
      );
    }

    if (productName.includes("冬") && quantity % 4 !== 0) {
      return NextResponse.json(
        { error: "冬いちごは4の倍数で入力してください。" },
        { status: 400 }
      );
    }

    const PIECES_PER_SHEET_OPTIONS = [30, 24, 20];
    if (!piecesPerSheet || !PIECES_PER_SHEET_OPTIONS.includes(Number(piecesPerSheet))) {
      return NextResponse.json(
        { error: "1シートあたりの玉数を選択してください。" },
        { status: 400 }
      );
    }

    if (!postalAndAddress) {
      return NextResponse.json(
        { error: "郵便番号・住所を入力してください。" },
        { status: 400 }
      );
    }
    if (!recipientName) {
      return NextResponse.json(
        { error: "お届け先氏名を入力してください。" },
        { status: 400 }
      );
    }
    if (!phoneNumber) {
      return NextResponse.json(
        { error: "運送会社と連絡が取れる電話番号を入力してください。" },
        { status: 400 }
      );
    }
    if (!deliveryDate) {
      return NextResponse.json(
        { error: "ご希望の到着日を選択してください。" },
        { status: 400 }
      );
    }

    const minDate = getMinDeliveryDate();
    const selectedDate = new Date(deliveryDate);
    if (Number.isNaN(selectedDate.getTime())) {
      return NextResponse.json(
        { error: "到着希望日が正しく入力されていません。" },
        { status: 400 }
      );
    }
    if (selectedDate < minDate) {
      const minStr = minDate.toISOString().slice(0, 10);
      return NextResponse.json(
        { error: `到着希望日は ${minStr} 以降の日付を選択してください。` },
        { status: 400 }
      );
    }

    const now = new Date(
      new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    );

    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const datePart = `${yyyy}${mm}${dd}`;

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const { count, error: countError } = await client
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayStart.toISOString())
      .lt("created_at", dayEnd.toISOString());

    if (countError) {
      console.error("[/api/mock-orders POST] orders count error", countError);
      return NextResponse.json(
        { error: "注文番号の採番に失敗しました。" },
        { status: 500 }
      );
    }

    const seq = (count ?? 0) + 1;
    const orderNumber = `ORD-${datePart}-${String(seq).padStart(4, "0")}`;

    let unitPrice: number | null =
      typeof body.unitPrice === "number" ? body.unitPrice : null;
    let taxRate: number | null =
      typeof body.taxRate === "number" ? body.taxRate : null;

    const piecesNum = piecesPerSheet != null ? Number(piecesPerSheet) : null;

    if (unitPrice == null && piecesNum != null) {
      const candidate = NATSUAKI_STRAWBERRY_PRICES[piecesNum];
      if (typeof candidate === "number") unitPrice = candidate;
    }

    if (taxRate == null && piecesNum != null) {
      if (NATSUAKI_STRAWBERRY_PRICES[piecesNum] != null) taxRate = DEFAULT_TAX_RATE;
    }

    if ((unitPrice == null || taxRate == null) && productId) {
      const master = PRODUCTS.find((p) => p.id === productId);
      if (master) {
        if (unitPrice == null) unitPrice = master.unitPrice;
        if (taxRate == null) taxRate = master.taxRate;
      }
    }

    const subtotal = unitPrice != null ? unitPrice * quantity : null;
    const taxAmount =
      subtotal != null && taxRate != null
        ? Math.round(subtotal * (Number(taxRate) / 100))
        : null;
    const totalAmount =
      subtotal != null && taxAmount != null ? subtotal + taxAmount : null;

    const { data, error: insertError } = await client
      .from("orders")
      .insert({
        order_number: orderNumber,
        product_id: productId,
        product_name: productName,
        pieces_per_sheet: piecesPerSheet,
        quantity,
        postal_and_address: postalAndAddress,
        recipient_name: recipientName,
        phone_number: phoneNumber,
        delivery_date: deliveryDate,
        delivery_time_note: deliveryTimeNote,
        agency_id: agencyId ?? null,
        agency_name: agencyName ?? null,
        created_by_email: createdByEmail ?? null,
        status: "pending",
        unit_price: unitPrice,
        tax_rate: taxRate,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      })
      .select(
        `
        id,
        order_number,
        product_id,
        product_name,
        pieces_per_sheet,
        quantity,
        postal_and_address,
        recipient_name,
        phone_number,
        delivery_date,
        delivery_time_note,
        agency_id,
        agency_name,
        created_by_email,
        status,
        unit_price,
        tax_rate,
        subtotal,
        tax_amount,
        total_amount,
        created_at
      `
      )
      .single();

    if (insertError) {
      console.error("[/api/mock-orders POST] Supabase insert error:", insertError);
      return NextResponse.json(
        { error: `注文の保存に失敗しました: ${insertError.message}` },
        { status: 500 }
      );
    }

    let saved: MockOrder = {
      id: data.id,
      orderNumber: data.order_number,
      productId: data.product_id ?? productId,
      productName: data.product_name ?? productName,
      piecesPerSheet: data.pieces_per_sheet ?? piecesPerSheet,
      quantity: data.quantity ?? quantity,
      postalAndAddress: data.postal_and_address ?? postalAndAddress,
      recipientName: data.recipient_name ?? recipientName,
      phoneNumber: data.phone_number ?? phoneNumber,
      deliveryDate: data.delivery_date ?? deliveryDate,
      deliveryTimeNote: data.delivery_time_note ?? deliveryTimeNote,
      agencyId: data.agency_id ?? agencyId,
      agencyName: data.agency_name ?? agencyName,
      createdByEmail: data.created_by_email ?? createdByEmail,
      status: (data.status as OrderStatus) ?? "pending",
      createdAt: data.created_at ?? now.toISOString(),
      unitPrice: data.unit_price ?? unitPrice,
      taxRate: data.tax_rate ?? taxRate,
      subtotal: data.subtotal ?? subtotal,
      taxAmount: data.tax_amount ?? taxAmount,
      totalAmount: data.total_amount ?? totalAmount,
    };

    // ===== メール送信 =====
    console.log("[/api/mock-orders POST] sending order email", {
      orderNumber: saved.orderNumber,
      mode: ORDER_MAIL_MODE,
    });

    const agencyLabel =
      saved.agencyName && saved.agencyName.trim().length > 0
        ? saved.agencyName.trim()
        : "代理店名未設定";

    const orderDateStr = now.toISOString().slice(0, 10);
    const subject = `いちご発注受付（${agencyLabel} / ${orderDateStr}）`;

    const mailLines: string[] = [];
    mailLines.push("いちご発注が登録されました。");
    mailLines.push("");
    mailLines.push(`注文番号：${saved.orderNumber}`);
    mailLines.push("");
    mailLines.push("【商品情報】");
    mailLines.push("いちごの種類：いちご");
    mailLines.push(`玉数/シート：${saved.piecesPerSheet ?? "-"}玉`);
    mailLines.push(`シート数：${saved.quantity}シート`);
    mailLines.push("");
    mailLines.push("【お届け先】");
    mailLines.push(`郵便番号・住所：${saved.postalAndAddress}`);
    mailLines.push(`お届け先氏名：${saved.recipientName}`);
    mailLines.push(`電話番号：${saved.phoneNumber}`);
    mailLines.push("");
    mailLines.push("【到着希望】");
    mailLines.push(`希望到着日：${saved.deliveryDate ?? "-"}`);
    mailLines.push(`時間帯・メモ：${saved.deliveryTimeNote ?? "-"}`);
    mailLines.push("");
    mailLines.push("【発注者】");
    mailLines.push(`代理店名：${saved.agencyName ?? "-"}`);
    mailLines.push(`メールアドレス：${saved.createdByEmail ?? "-"}`);

    const bodyText = mailLines.join("\n");

    let messageId: string | null = null;

    if (ORDER_MAIL_MODE === "ses") {
      const { sendOrderEmail } = await import("@/lib/ses");
      try {
        messageId = await sendOrderEmail({ subject, bodyText });

        // ★ 修正：MessageId が取れない（=設定不足で送信スキップ等）場合でも 500 にしない
        // ここで 500 にすると、DB保存済みなのにユーザーが再送→重複注文の原因になる
        if (!messageId) {
          console.warn("[SES] Email skipped or MessageId missing. Keep order as pending.", {
            orderNumber: saved.orderNumber,
          });
          return NextResponse.json({
            ok: true,
            order: saved, // status: pending のまま
            emailSent: false,
          });
        }

        console.log("[SES] Order mail sent", {
          orderNumber: saved.orderNumber,
          messageId,
        });
      } catch (err) {
        console.error("[SES] Failed to send order mail", err);
        return NextResponse.json(
          { error: "メール送信に失敗しました。" },
          { status: 500 }
        );
      }
    } else {
      console.log("[MOCK EMAIL] 発注メール送信:", { subject, bodyText });
      messageId = "mock";
    }

    // 送れた場合のみ sent に更新
    const emailSentAt = new Date().toISOString();
    const { data: sentData, error: sentError } = await client
      .from("orders")
      .update({
        status: "sent",
        email_sent_at: emailSentAt,
        email_message_id: messageId,
      })
      .eq("id", saved.id)
      .select(
        `
        id,
        order_number,
        product_id,
        product_name,
        pieces_per_sheet,
        quantity,
        postal_and_address,
        recipient_name,
        phone_number,
        delivery_date,
        delivery_time_note,
        agency_id,
        agency_name,
        created_by_email,
        status,
        unit_price,
        tax_rate,
        subtotal,
        tax_amount,
        total_amount,
        created_at
      `
      )
      .single();

    if (sentError) {
      console.error("[/api/mock-orders POST] update sent status error:", sentError);
      return NextResponse.json(
        { error: "メール送信後の状態更新に失敗しました。" },
        { status: 500 }
      );
    }

    saved = {
      id: sentData.id,
      orderNumber: sentData.order_number,
      productId: sentData.product_id ?? productId,
      productName: sentData.product_name ?? productName,
      piecesPerSheet: sentData.pieces_per_sheet ?? piecesPerSheet,
      quantity: sentData.quantity ?? quantity,
      postalAndAddress: sentData.postal_and_address ?? postalAndAddress,
      recipientName: sentData.recipient_name ?? recipientName,
      phoneNumber: sentData.phone_number ?? phoneNumber,
      deliveryDate: sentData.delivery_date ?? deliveryDate,
      deliveryTimeNote: sentData.delivery_time_note ?? deliveryTimeNote,
      agencyId: sentData.agency_id ?? agencyId,
      agencyName: sentData.agency_name ?? agencyName,
      createdByEmail: sentData.created_by_email ?? createdByEmail,
      status: (sentData.status as OrderStatus) ?? "sent",
      createdAt: sentData.created_at ?? now.toISOString(),
      unitPrice: sentData.unit_price ?? unitPrice,
      taxRate: sentData.tax_rate ?? taxRate,
      subtotal: sentData.subtotal ?? subtotal,
      taxAmount: sentData.tax_amount ?? taxAmount,
      totalAmount: sentData.total_amount ?? totalAmount,
    };

    return NextResponse.json({ ok: true, order: saved, emailSent: true });
  } catch (error: any) {
    console.error("[/api/mock-orders POST] Unexpected error:", error);
    return NextResponse.json(
      { error: error?.message ?? "注文の登録中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const client = ensureSupabase();
    if (!client) {
      return NextResponse.json(
        { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      id?: string;
      status?: OrderStatus;
      unitPrice?: number | null;
      taxRate?: number | null;
    };

    const { id, status, unitPrice, taxRate } = body;

    if (!id) {
      return NextResponse.json(
        { error: "更新対象の注文 ID が指定されていません。" },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: "更新後のステータスが指定されていません。" },
        { status: 400 }
      );
    }

    const allowed: OrderStatus[] = ["pending", "sent", "canceled"];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: "不正なステータスです。" },
        { status: 400 }
      );
    }

    if (status === "canceled") {
      const { error } = await client.from("orders").delete().eq("id", id);

      if (error) {
        console.error("[/api/mock-orders PATCH] Supabase delete error:", error);
        return NextResponse.json(
          { error: `注文の削除に失敗しました: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, deletedId: id });
    }

    const updatePayload: any = { status };

    if (typeof unitPrice === "number") updatePayload.unit_price = unitPrice;
    if (typeof taxRate === "number") updatePayload.tax_rate = taxRate;

    if (typeof unitPrice === "number" || typeof taxRate === "number") {
      const { data: current, error: fetchError } = await client
        .from("orders")
        .select("quantity, unit_price, tax_rate")
        .eq("id", id)
        .single();

      if (fetchError) {
        console.error("[/api/mock-orders PATCH] fetch current order error:", fetchError);
      } else {
        const q = current.quantity as number;
        const u =
          typeof unitPrice === "number"
            ? unitPrice
            : (current.unit_price as number | null);
        const t =
          typeof taxRate === "number"
            ? taxRate
            : (current.tax_rate as number | null);

        const subtotal = u != null ? u * q : null;
        const taxAmount =
          subtotal != null && t != null
            ? Math.round(subtotal * (Number(t) / 100))
            : null;
        const totalAmount =
          subtotal != null && taxAmount != null ? subtotal + taxAmount : null;

        updatePayload.subtotal = subtotal;
        updatePayload.tax_amount = taxAmount;
        updatePayload.total_amount = totalAmount;
      }
    }

    const { data, error } = await client
      .from("orders")
      .update(updatePayload)
      .eq("id", id)
      .select(
        `
        id,
        order_number,
        product_id,
        product_name,
        pieces_per_sheet,
        quantity,
        postal_and_address,
        recipient_name,
        phone_number,
        delivery_date,
        delivery_time_note,
        agency_id,
        agency_name,
        created_by_email,
        status,
        unit_price,
        tax_rate,
        subtotal,
        tax_amount,
        total_amount,
        created_at
      `
      )
      .single();

    if (error) {
      console.error("[/api/mock-orders PATCH] Supabase error:", error);
      return NextResponse.json(
        { error: `注文ステータスの更新に失敗しました: ${error.message}` },
        { status: 500 }
      );
    }

    const updated: MockOrder = {
      id: data.id,
      orderNumber: data.order_number,
      productId: data.product_id ?? null,
      productName: data.product_name ?? "",
      piecesPerSheet: data.pieces_per_sheet ?? null,
      quantity: data.quantity ?? 0,
      postalAndAddress: data.postal_and_address ?? "",
      recipientName: data.recipient_name ?? "",
      phoneNumber: data.phone_number ?? "",
      deliveryDate: data.delivery_date ?? null,
      deliveryTimeNote: data.delivery_time_note ?? null,
      agencyId: data.agency_id ?? null,
      agencyName: data.agency_name ?? null,
      createdByEmail: data.created_by_email ?? null,
      status: (data.status as OrderStatus) ?? "pending",
      createdAt: data.created_at ?? new Date().toISOString(),
      unitPrice: data.unit_price ?? null,
      taxRate: data.tax_rate ?? null,
      subtotal: data.subtotal ?? null,
      taxAmount: data.tax_amount ?? null,
      totalAmount: data.total_amount ?? null,
    };

    return NextResponse.json({ ok: true, order: updated });
  } catch (error: any) {
    console.error("[/api/mock-orders PATCH] Unexpected error:", error);
    return NextResponse.json(
      { error: error?.message ?? "注文ステータス更新中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
