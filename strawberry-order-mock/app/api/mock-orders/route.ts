import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PRODUCTS } from "../mock-products/route";

export const runtime = "nodejs";

export type OrderStatus = "pending" | "shipped" | "canceled";

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

// 夏秋苺（税抜）価格マスタ：pieces_per_sheet -> unitPrice
const NATSUAKI_STRAWBERRY_PRICES: Record<number, number> = {
  20: 1600,
  24: 1500,
  30: 1450,
  36: 1200,
};
const DEFAULT_TAX_RATE = 10; // 10%

function ensureSupabase() {
  if (!supabaseAdmin) {
    console.error(
      "[/api/mock-orders] supabaseAdmin is null. Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."
    );
    return null;
  }
  return supabaseAdmin;
}

// 本日から 3 日後 0:00
function getMinDeliveryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 注文一覧取得
 * - ?agencyName=xxx が指定された場合は代理店名で絞り込み
 */
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

    if (agencyName) {
      query = query.eq("agency_name", agencyName);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[/api/mock-orders GET] orders error:", error);
      return NextResponse.json(
        { error: `注文一覧の取得に失敗しました: ${error.message}` },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as any[];

    const orders: MockOrder[] = rows.map((r) => ({
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
      agencyName: r.agency_name ?? null,
      createdByEmail: r.created_by_email ?? null,
      status: (r.status as OrderStatus) ?? "pending",
      createdAt: r.created_at ?? new Date().toISOString(),
      unitPrice: r.unit_price ?? null,
      taxRate: r.tax_rate ?? null,
      subtotal: r.subtotal ?? null,
      taxAmount: r.tax_amount ?? null,
      totalAmount: r.total_amount ?? null,
    }));

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error("[/api/mock-orders GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "注文一覧の取得中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}

/**
 * 新規注文作成
 */
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

    // ===== productId（NOT NULL 制約用に必須） =====
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

    // ===== 商品名 =====
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

    // ===== そのほか入力値 =====
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
    const agencyName = body.agencyName ?? body.agency_name ?? null;

    // ===== バリデーション（フロントと同等） =====
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

    const PIECES_PER_SHEET_OPTIONS = [36, 30, 24, 20];
    if (
      !piecesPerSheet ||
      !PIECES_PER_SHEET_OPTIONS.includes(Number(piecesPerSheet))
    ) {
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

    const now = new Date();

    // ===== 注文番号（ORD-YYYYMMDD-XXXX） =====
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

    // ===== 金額：body > 夏秋苺価格マスタ > PRODUCTS の順に採用 =====
    let unitPrice: number | null =
      typeof body.unitPrice === "number" ? body.unitPrice : null;
    let taxRate: number | null =
      typeof body.taxRate === "number" ? body.taxRate : null;

    const piecesNum =
      piecesPerSheet != null ? Number(piecesPerSheet) : null;

    if (unitPrice == null && piecesNum != null) {
      const candidate = NATSUAKI_STRAWBERRY_PRICES[piecesNum];
      if (typeof candidate === "number") {
        unitPrice = candidate;
      }
    }

    if (taxRate == null && piecesNum != null) {
      if (NATSUAKI_STRAWBERRY_PRICES[piecesNum] != null) {
        taxRate = DEFAULT_TAX_RATE;
      }
    }

    if ((unitPrice == null || taxRate == null) && productId) {
      const master = PRODUCTS.find((p) => p.id === productId);
      if (master) {
        if (unitPrice == null) unitPrice = master.unitPrice;
        if (taxRate == null) taxRate = master.taxRate;
      }
    }

    const subtotal =
      unitPrice != null ? unitPrice * quantity : null;
    const taxAmount =
      subtotal != null && taxRate != null
        ? Math.round(subtotal * (Number(taxRate) / 100))
        : null;
    const totalAmount =
      subtotal != null && taxAmount != null ? subtotal + taxAmount : null;

    // ===== Supabase に保存 =====
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

    const saved: MockOrder = {
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
    const agencyLabel =
      saved.agencyName && saved.agencyName.trim().length > 0
        ? saved.agencyName.trim()
        : "代理店名未設定";

    const orderDateStr = saved.createdAt.slice(0, 10);

    const subject = `いちご発注受付（${agencyLabel} / ${orderDateStr}）`;

    const mailLines: string[] = [];
    mailLines.push("いちご発注が登録されました。");
    mailLines.push("");
    mailLines.push(`注文番号：${saved.orderNumber}`);
    mailLines.push("");
    mailLines.push("【商品情報】");
    mailLines.push(`いちごの種類：${saved.productName}`);
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

    if (ORDER_MAIL_MODE === "ses") {
      const { sendOrderEmail } = await import("@/lib/ses");
      try {
        await sendOrderEmail({ subject, bodyText });
        console.log("[SES] Order mail sent", {
          orderNumber: saved.orderNumber,
        });
      } catch (err) {
        console.error("[SES] Failed to send order mail", err);
      }
    } else {
      console.log("[MOCK EMAIL] 発注メール送信:", { subject, bodyText });
    }

    return NextResponse.json({ ok: true, order: saved });
  } catch (error: any) {
    console.error("[/api/mock-orders POST] Unexpected error:", error);
    return NextResponse.json(
      { error: error?.message ?? "注文の登録中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}

/**
 * ステータス更新用 PATCH（管理画面向け）
 */
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

    const allowed: OrderStatus[] = ["pending", "shipped", "canceled"];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: "不正なステータスです。" },
        { status: 400 }
      );
    }

    // 金額再計算（単価/税率が送られてきた場合）
    const updatePayload: any = { status };

    if (typeof unitPrice === "number") {
      updatePayload.unit_price = unitPrice;
    }
    if (typeof taxRate === "number") {
      updatePayload.tax_rate = taxRate;
    }

    if (typeof unitPrice === "number" || typeof taxRate === "number") {
      const { data: current, error: fetchError } = await client
        .from("orders")
        .select("quantity, unit_price, tax_rate")
        .eq("id", id)
        .single();

      if (fetchError) {
        console.error(
          "[/api/mock-orders PATCH] fetch current order error:",
          fetchError
        );
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

        const subtotal =
          u != null ? u * q : null;
        const taxAmount =
          subtotal != null && t != null
            ? Math.round(subtotal * (Number(t) / 100))
            : null;
        const totalAmount =
          subtotal != null && taxAmount != null
            ? subtotal + taxAmount
            : null;

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
