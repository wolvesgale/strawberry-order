// app/api/mock-orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendOrderEmail } from "@/lib/ses";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type OrderStatus = "pending" | "shipped" | "canceled";

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
};

const ORDER_MAIL_MODE = process.env.ORDER_MAIL_MODE ?? "mock";

// 本日から 3 日後 0:00
function getMinDeliveryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  // ★ ここで null ガード
  if (!supabaseAdmin) {
    console.error(
      "[GET /api/mock-orders] Supabase admin client is not configured"
    );
    return NextResponse.json(
      {
        error: "サーバー設定エラーが発生しました。",
        orders: [],
      },
      { status: 500 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
          id,
          order_number,
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
          created_at
        `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/mock-orders] orders select error", error);
      return NextResponse.json(
        { error: "注文一覧の取得に失敗しました。" },
        { status: 500 }
      );
    }

    const orders: MockOrder[] =
      (data ?? []).map((row: any) => ({
        id: row.id,
        orderNumber: row.order_number,
        productName: row.product_name ?? "",
        piecesPerSheet: row.pieces_per_sheet ?? null,
        quantity: row.quantity ?? 0,
        postalAndAddress: row.postal_and_address ?? "",
        recipientName: row.recipient_name ?? "",
        phoneNumber: row.phone_number ?? "",
        deliveryDate: row.delivery_date ?? null,
        deliveryTimeNote: row.delivery_time_note ?? null,
        agencyName: row.agency_name ?? null,
        createdByEmail: row.created_by_email ?? null,
        status: (row.status as OrderStatus) ?? "pending",
        createdAt: row.created_at,
      })) ?? [];

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("[GET /api/mock-orders] unexpected error", error);
    return NextResponse.json(
      { error: "注文一覧の取得中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // ★ ここでも null ガード
  if (!supabaseAdmin) {
    console.error(
      "[POST /api/mock-orders] Supabase admin client is not configured"
    );
    return NextResponse.json(
      { error: "サーバー設定エラーが発生しました。" },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as any;
    console.log("[MOCK ORDER BODY]", body);

    // ===== いちごの種類（productName） =====
    const rawProduct =
      body.product ??
      body.selectedProduct ??
      body.productId ??
      body.productName ??
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

      if (typeof candidate === "string" || typeof candidate === "number") {
        productName = String(candidate).trim();
      }
    }

    if (!productName) {
      productName = "商品名未設定";
    }

    // ===== 1シートあたりの玉数 =====
    const piecesRaw =
      body.piecesPerSheet ??
      body.pieces_per_sheet ??
      body.pieces ??
      body.ballsPerSheet;

    const piecesPerSheet =
      typeof piecesRaw === "number" ? piecesRaw : Number(piecesRaw);

    if (![36, 30, 24, 20].includes(piecesPerSheet)) {
      return NextResponse.json(
        {
          error:
            "1シートあたりの玉数は36玉 / 30玉 / 24玉 / 20玉から選択してください。",
        },
        { status: 400 }
      );
    }

    // ===== セット数（シート数） =====
    const quantityRaw =
      body.quantity ?? body.sheetCount ?? body.sets ?? body.count;
    const quantity =
      typeof quantityRaw === "number" ? quantityRaw : Number(quantityRaw);

    if (!Number.isInteger(quantity) || quantity < 2 || quantity % 2 !== 0) {
      return NextResponse.json(
        { error: "セット数（シート数）は2以上の偶数で入力してください。" },
        { status: 400 }
      );
    }

    // 冬いちごだけ 4 の倍数チェック
    if (productName.includes("冬") && quantity % 4 !== 0) {
      return NextResponse.json(
        { error: "冬いちごは4の倍数で入力してください。" },
        { status: 400 }
      );
    }

    // ===== お届け先情報 =====
    const postalAndAddress =
      typeof body.postalAndAddress === "string"
        ? body.postalAndAddress.trim()
        : "";
    const recipientName =
      typeof body.recipientName === "string"
        ? body.recipientName.trim()
        : "";
    const phoneNumber =
      typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";

    if (!postalAndAddress || !recipientName || !phoneNumber) {
      return NextResponse.json(
        { error: "お届け先情報（住所・氏名・電話番号）を入力してください。" },
        { status: 400 }
      );
    }

    // ===== 到着希望日（3日後以降） =====
    const deliveryDate =
      typeof body.deliveryDate === "string" ? body.deliveryDate : "";

    if (!deliveryDate) {
      return NextResponse.json(
        { error: "ご希望の到着日を選択してください。" },
        { status: 400 }
      );
    }

    const parsedDelivery = new Date(deliveryDate);
    if (Number.isNaN(parsedDelivery.getTime())) {
      return NextResponse.json(
        { error: "到着日の形式が正しくありません。" },
        { status: 400 }
      );
    }

    const minDate = getMinDeliveryDate();
    if (parsedDelivery < minDate) {
      return NextResponse.json(
        {
          error:
            "到着希望日は本日から3日後以降の日付を選択してください。",
        },
        { status: 400 }
      );
    }

    const deliveryTimeNote =
      typeof body.deliveryTimeNote === "string"
        ? body.deliveryTimeNote.trim()
        : null;

    const agencyName =
      typeof body.agencyName === "string" ? body.agencyName.trim() : null;

    const createdByEmail =
      typeof body.createdByEmail === "string"
        ? body.createdByEmail.trim()
        : null;

    const now = new Date();

    // ===== 注文番号（ORD-YYYYMMDD-XXXX） =====
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const datePart = `${yyyy}${mm}${dd}`;

    // 当日分の件数をカウントして連番を付与
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const { count, error: countError } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayStart.toISOString())
      .lt("created_at", dayEnd.toISOString());

    if (countError) {
      console.error(
        "[POST /api/mock-orders] orders count error",
        countError
      );
      return NextResponse.json(
        { error: "注文番号の採番に失敗しました。" },
        { status: 500 }
      );
    }

    const seq = (count ?? 0) + 1;
    const orderNumber = `ORD-${datePart}-${String(seq).padStart(4, "0")}`;

    // ===== 金額関連（ひとまず 0 で保存。あとで管理画面から編集する前提） =====
    const unitPrice = 0;
    const taxRate = 0;
    const subtotal = 0;
    const taxAmount = 0;
    const totalAmount = 0;

    // ===== Supabase に保存 =====
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("orders")
      .insert({
        order_number: orderNumber,
        product_name: productName,
        pieces_per_sheet: piecesPerSheet,
        quantity,
        postal_and_address: postalAndAddress,
        recipient_name: recipientName,
        phone_number: phoneNumber,
        delivery_date: deliveryDate,
        delivery_time_note: deliveryTimeNote,
        agency_name: agencyName,
        created_by_email: createdByEmail,
        status: "pending",
        unit_price: unitPrice,
        tax_rate: taxRate,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      console.error(
        "[POST /api/mock-orders] orders insert error",
        insertError
      );
      return NextResponse.json(
        { error: "注文の保存に失敗しました。" },
        { status: 500 }
      );
    }

    const order: MockOrder = {
      id: inserted.id,
      orderNumber,
      productName,
      piecesPerSheet,
      quantity,
      postalAndAddress,
      recipientName,
      phoneNumber,
      deliveryDate,
      deliveryTimeNote,
      agencyName,
      createdByEmail,
      status: "pending",
      createdAt: inserted.created_at,
    };

    console.log("[MOCK ORDER CREATED]", order);

    // ===== ここからメール送信（仕入れ先向け・金額なし） =====
    const agencyLabel =
      order.agencyName && order.agencyName.trim().length > 0
        ? order.agencyName.trim()
        : "代理店名未設定";

    const orderDateStr = order.createdAt.slice(0, 10); // YYYY-MM-DD

    const subject = `いちご発注受付（${agencyLabel} / ${orderDateStr}）`;

    const mailLines: string[] = [];

    mailLines.push("いちご発注が登録されました。");
    mailLines.push("");
    mailLines.push(`注文番号：${order.orderNumber}`);
    mailLines.push("");
    mailLines.push("【商品情報】");
    mailLines.push(`いちごの種類：${order.productName}`);
    mailLines.push(`玉数/シート：${order.piecesPerSheet ?? "-"}玉`);
    mailLines.push(`シート数：${order.quantity}シート`);
    mailLines.push("");
    mailLines.push("【お届け先】");
    mailLines.push(`郵便番号・住所：${order.postalAndAddress}`);
    mailLines.push(`お届け先氏名：${order.recipientName}`);
    mailLines.push(`電話番号：${order.phoneNumber}`);
    mailLines.push("");
    mailLines.push("【到着希望】");
    mailLines.push(`希望到着日：${order.deliveryDate ?? "-"}`);
    mailLines.push(`時間帯・メモ：${order.deliveryTimeNote ?? "-"}`);
    mailLines.push("");
    mailLines.push("【発注者】");
    mailLines.push(`代理店名：${order.agencyName ?? "-"}`);
    mailLines.push(`メールアドレス：${order.createdByEmail ?? "-"}`);

    const bodyText = mailLines.join("\n");

    if (ORDER_MAIL_MODE === "ses") {
      try {
        await sendOrderEmail({ subject, bodyText });
        console.log("[SES] Order mail sent", {
          orderNumber: order.orderNumber,
        });
      } catch (err) {
        console.error("[SES] Failed to send order mail", err);
      }
    } else {
      console.log("[MOCK EMAIL] 発注メール送信:", {
        subject,
        bodyText,
      });
    }

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error("[POST /api/mock-orders] error", error);
    return NextResponse.json(
      { error: "注文の登録中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
