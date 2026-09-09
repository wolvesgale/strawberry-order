import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const SETUP_SECRET = "saiya-setup-2026";
const ALLOWED_EMAIL = "wolvesgale0512@gmail.com";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { secret, password } = body;

  if (secret !== SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "パスワードは8文字以上必要です" }, { status: 400 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const { data: user, error: findError } = await supabaseAdmin.auth.admin.listUsers();
  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  const target = user.users.find((u) => u.email === ALLOWED_EMAIL);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    target.id,
    { password }
  );

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
