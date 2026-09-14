import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// PATCH: 代理店名変更（agencies + orders.agency_name を更新）
export async function PATCH(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const id = (body.id as string)?.trim();
  const name = (body.name as string)?.trim();

  if (!id || !name) {
    return NextResponse.json({ error: "代理店IDと名前は必須です。" }, { status: 400 });
  }

  const { error: agencyError } = await supabaseAdmin
    .from("agencies")
    .update({ name })
    .eq("id", id);

  if (agencyError) {
    return NextResponse.json({ error: agencyError.message }, { status: 500 });
  }

  // orders.agency_name も連動して更新
  const { error: ordersError } = await supabaseAdmin
    .from("orders")
    .update({ agency_name: name })
    .eq("agency_id", id);

  if (ordersError) {
    console.error("[/api/admin/agencies PATCH] orders update error", ordersError);
  }

  return NextResponse.json({ ok: true, name });
}
