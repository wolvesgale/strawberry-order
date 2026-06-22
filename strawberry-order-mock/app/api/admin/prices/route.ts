import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function ensureSupabase() {
  if (!supabaseAdmin) {
    console.error("[/api/admin/prices] supabaseAdmin is null.");
    return null;
  }
  return supabaseAdmin;
}

export async function GET() {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json({ error: "サーバー設定エラーです。" }, { status: 500 });
  }

  try {
    const { data, error } = await client
      .from("product_prices")
      .select("id, product_name, pieces_per_sheet, unit_price, tax_rate, effective_from, effective_to, created_at")
      .order("effective_from", { ascending: false });

    if (error) {
      console.error("[/api/admin/prices GET]", error);
      return NextResponse.json({ error: "価格情報の取得に失敗しました。" }, { status: 500 });
    }

    return NextResponse.json({ prices: data ?? [] });
  } catch (e) {
    console.error("[/api/admin/prices GET] unexpected", e);
    return NextResponse.json({ error: "価格情報の取得に失敗しました。" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json({ error: "サーバー設定エラーです。" }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { productName, piecesPerSheet, unitPrice, taxRate, effectiveFrom, effectiveTo } = body as {
      productName?: string;
      piecesPerSheet?: number | string | null;
      unitPrice?: number | string;
      taxRate?: number | string;
      effectiveFrom?: string;
      effectiveTo?: string | null;
    };

    if (!productName?.trim() || !unitPrice || !effectiveFrom?.trim()) {
      return NextResponse.json(
        { error: "商品名、単価、適用開始日は必須です。" },
        { status: 400 }
      );
    }

    const parsedUnitPrice = Number(unitPrice);
    const parsedTaxRate = Number(taxRate ?? 8);
    const parsedPiecesPerSheet = piecesPerSheet ? Number(piecesPerSheet) : null;

    if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice <= 0) {
      return NextResponse.json({ error: "単価は正の数値で入力してください。" }, { status: 400 });
    }

    const { data, error } = await client
      .from("product_prices")
      .insert({
        product_name: productName.trim(),
        pieces_per_sheet: parsedPiecesPerSheet,
        unit_price: parsedUnitPrice,
        tax_rate: parsedTaxRate,
        effective_from: effectiveFrom.trim(),
        effective_to: effectiveTo?.trim() || null,
      })
      .select("id, product_name, pieces_per_sheet, unit_price, tax_rate, effective_from, effective_to, created_at")
      .maybeSingle();

    if (error) {
      console.error("[/api/admin/prices POST]", error);
      return NextResponse.json({ error: "価格の登録に失敗しました。" }, { status: 500 });
    }

    return NextResponse.json({ price: data });
  } catch (e) {
    console.error("[/api/admin/prices POST] unexpected", e);
    return NextResponse.json({ error: "価格の登録に失敗しました。" }, { status: 500 });
  }
}
