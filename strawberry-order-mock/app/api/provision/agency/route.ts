import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ─────────────────────────────────────────────────────────────
// 横断管理ハブ（GAS）専用の代理店アカウント発行エンドポイント。
// 既存の /api/admin/users には一切手を加えず、これを新規追加するだけ。
// 認証は共有シークレット（Authorization: Bearer <PROVISION_API_SECRET>）。
// これにより「いちご(Strawberry)側の既存挙動」は変わらない。
// 必要な環境変数(Vercel):
//   PROVISION_API_SECRET  … GASと共有する十分に長いランダム文字列
//   APP_BASE_URL          … 例 https://strawberry-order.vercel.app （任意・未設定なら既定値）
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY … 既存のものを流用
// ─────────────────────────────────────────────────────────────

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function generatePassword(length = 16) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 24);
  return `${base || "agency"}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function POST(req: Request) {
  // 1) 共有シークレット認証
  const secret = process.env.PROVISION_API_SECRET;
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!secret || token !== secret) return unauthorized();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "サーバー設定エラー（Supabase未設定）" }, { status: 500 });
  }
  const client = supabaseAdmin;

  // 2) 入力
  const body = (await req.json().catch(() => ({}))) as {
    agencyName?: string;
    name?: string;
    displayName?: string;
    email?: string;
    password?: string;
  };
  const agencyName = (body.agencyName ?? body.name)?.trim();
  const email = body.email?.trim();
  const displayName = (body.displayName ?? body.name ?? agencyName)?.trim();
  const password = body.password?.trim() || generatePassword();

  if (!agencyName || !email) {
    return NextResponse.json({ error: "agencyName と email は必須です" }, { status: 400 });
  }

  // 3) 代理店（agencies）: 同名があれば流用、無ければ作成
  let agencyId: string | null = null;
  {
    const { data: existing, error } = await client
      .from("agencies")
      .select("id")
      .eq("name", agencyName)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "代理店確認に失敗しました" }, { status: 500 });
    if (existing) {
      agencyId = existing.id;
    } else {
      const { data: created, error: insErr } = await client
        .from("agencies")
        .insert({ name: agencyName, code: slugify(agencyName) })
        .select("id")
        .maybeSingle();
      if (insErr) return NextResponse.json({ error: "代理店作成に失敗しました" }, { status: 500 });
      agencyId = created?.id ?? null;
    }
  }

  // 4) Supabase Auth ユーザー作成
  const { data: authCreated, error: authErr } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !authCreated.user) {
    return NextResponse.json(
      { error: "ユーザー作成に失敗しました", detail: authErr?.message },
      { status: 500 }
    );
  }

  // 5) profiles 登録（role=agency）
  const { error: profErr } = await client.from("profiles").insert({
    id: authCreated.user.id,
    display_name: displayName,
    role: "agency",
    agency_id: agencyId,
    email: email.toLowerCase(),
  });
  if (profErr) {
    return NextResponse.json(
      { error: "プロフィール作成に失敗しました", detail: profErr.message },
      { status: 500 }
    );
  }

  // 6) 結果（発行1セット）
  const base = process.env.APP_BASE_URL || "https://strawberry-order.vercel.app";
  return NextResponse.json({
    ok: true,
    system: "strawberry",
    loginUrl: `${base}/login`,
    email,
    password,
    agencyName,
    userId: authCreated.user.id,
  });
}
