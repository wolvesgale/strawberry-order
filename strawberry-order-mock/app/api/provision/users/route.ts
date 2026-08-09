import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ─────────────────────────────────────────────────────────────
// 横断管理ハブ（GAS）専用のユーザー一覧＋操作エンドポイント。
// 既存の /api/admin/* には手を加えない独立ルート。共有シークレットで保護。
//   GET   … ユーザー一覧を返す
//   PATCH … { id, action: 'deactivate'|'activate'|'reset_password', newPassword? }
// 無効化/有効化は Supabase Auth の ban を利用（ログイン不可/可）。
// ─────────────────────────────────────────────────────────────

export const runtime = "nodejs";

function authorized(req: Request) {
  const secret = process.env.PROVISION_API_SECRET;
  const a = req.headers.get("authorization") || "";
  const t = a.startsWith("Bearer ") ? a.slice(7) : "";
  return !!secret && t === secret;
}

function genPassword(len = 16) {
  return crypto.randomBytes(len).toString("base64url").slice(0, len);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase未設定" }, { status: 500 });
  const c = supabaseAdmin;

  const [{ data: profiles, error: pe }, { data: agencies, error: ae }] = await Promise.all([
    c.from("profiles").select("id, display_name, role, agency_id, email"),
    c.from("agencies").select("id, name"),
  ]);
  if (pe || ae) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });

  const users: any[] = [];
  for (const p of profiles ?? []) {
    let email: string | null = (p as any).email ?? null;
    let active = true;
    let createdAt: string | null = null;
    try {
      const { data } = await c.auth.admin.getUserById(p.id);
      const u: any = data.user;
      email = u?.email ?? email;
      createdAt = u?.created_at ?? null;
      const bannedUntil = u?.banned_until ? new Date(u.banned_until) : null;
      active = !(bannedUntil && bannedUntil > new Date());
    } catch (e) {
      /* 個別失敗は無視 */
    }
    const agency = (agencies ?? []).find((a) => a.id === (p as any).agency_id);
    users.push({
      system: "strawberry",
      id: p.id,
      email,
      name: agency?.name ?? (p as any).display_name ?? null,
      role: (p as any).role,
      active,
      createdAt,
    });
  }
  return NextResponse.json({ users });
}

export async function PATCH(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase未設定" }, { status: 500 });
  const c = supabaseAdmin;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    action?: string;
    newPassword?: string;
  };
  const id = body.id?.trim();
  const action = body.action;
  if (!id || !action) return NextResponse.json({ error: "id と action は必須です" }, { status: 400 });

  if (action === "deactivate") {
    const { error } = await c.auth.admin.updateUserById(id, { ban_duration: "876000h" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action, active: false });
  }
  if (action === "activate") {
    const { error } = await c.auth.admin.updateUserById(id, { ban_duration: "none" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action, active: true });
  }
  if (action === "reset_password") {
    const newPassword = body.newPassword?.trim() || genPassword();
    const { error } = await c.auth.admin.updateUserById(id, { password: newPassword });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action, newPassword });
  }
  return NextResponse.json({ error: "不明なaction" }, { status: 400 });
}
