import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "サーバー設定エラーです。" }, { status: 500 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("agencies")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("[/api/admin/agencies GET]", error);
      return NextResponse.json({ error: "代理店情報の取得に失敗しました。" }, { status: 500 });
    }

    return NextResponse.json({ agencies: data ?? [] });
  } catch (e) {
    console.error("[/api/admin/agencies GET] unexpected", e);
    return NextResponse.json({ error: "代理店情報の取得に失敗しました。" }, { status: 500 });
  }
}
