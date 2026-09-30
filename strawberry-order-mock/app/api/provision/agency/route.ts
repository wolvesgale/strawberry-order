import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function checkSecret(req: NextRequest): boolean {
  const secret = process.env.PROVISION_API_SECRET;
  if (!secret) return false;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return token === secret;
}

function slugify(name: string) {
  const base = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 24);
  return `${base || "agency"}-${crypto.randomUUID().slice(0, 8)}`;
}

// POST /api/provision/agency
// Body: { agencyName, name, email, password }
export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = supabaseAdmin;
  if (!client) {
    return NextResponse.json({ ok: false, error: "Server config error" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const agencyName = (body.agencyName ?? body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const password = (body.password ?? "").trim();

  if (!agencyName || !email || !password) {
    return NextResponse.json(
      { ok: false, error: "agencyName, email, password は必須です。" },
      { status: 400 }
    );
  }

  // 既存ユーザー確認
  const { data: existingList } = await client.auth.admin.listUsers();
  const exists = existingList?.users?.some((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (exists) {
    return NextResponse.json(
      { ok: false, error: `${email} はすでに登録されています。` },
      { status: 409 }
    );
  }

  // agencies テーブルに upsert
  let agencyId: string | null = null;
  const { data: existingAgency } = await client
    .from("agencies")
    .select("id")
    .eq("name", agencyName)
    .maybeSingle();

  if (existingAgency) {
    agencyId = existingAgency.id;
  } else {
    const { data: newAgency, error: agencyError } = await client
      .from("agencies")
      .insert({ name: agencyName, code: slugify(agencyName) })
      .select("id")
      .maybeSingle();
    if (agencyError) {
      return NextResponse.json({ ok: false, error: "代理店の作成に失敗しました。" }, { status: 500 });
    }
    agencyId = newAgency?.id ?? null;
  }

  // Auth ユーザー作成
  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    return NextResponse.json(
      { ok: false, error: authError?.message ?? "ユーザー作成に失敗しました。" },
      { status: 500 }
    );
  }

  // profiles 作成（トリガーが先に行を作る場合があるので upsert）
  const { error: profileError } = await client.from("profiles").upsert({
    id: authData.user.id,
    display_name: agencyName,
    role: "agency",
    agency_id: agencyId,
    email: email.toLowerCase(),
  }, { onConflict: "id" });
  if (profileError) {
    await client.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json(
      { ok: false, error: "プロフィール作成に失敗しました。" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: authData.user.id });
}
