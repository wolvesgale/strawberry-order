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

function generatePassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(length))
    .map((b) => chars[b % chars.length])
    .join("");
}

// GET /api/provision/users
// Returns: { ok: true, users: [{ id, name, email, role, active, createdAt }] }
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = supabaseAdmin;
  if (!client) {
    return NextResponse.json({ ok: false, error: "Server config error" }, { status: 500 });
  }

  const { data: profiles, error: profilesError } = await client
    .from("profiles")
    .select("id, display_name, role, email, order_disabled")
    .order("role");

  if (profilesError) {
    return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });
  }

  const { data: authList } = await client.auth.admin.listUsers({ perPage: 1000 });
  const authMap = new Map(authList?.users?.map((u) => [u.id, u]) ?? []);

  const users = (profiles ?? []).map((p) => {
    const authUser = authMap.get(p.id);
    return {
      id: p.id,
      name: p.display_name ?? "",
      email: authUser?.email ?? p.email ?? "",
      role: p.role ?? "agency",
      active: authUser?.banned_until ? false : true,
      createdAt: authUser?.created_at ?? null,
    };
  });

  return NextResponse.json({ ok: true, users });
}

// PATCH /api/provision/users
// Body: { id, action: 'deactivate' | 'activate' | 'reset_password' }
export async function PATCH(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = supabaseAdmin;
  if (!client) {
    return NextResponse.json({ ok: false, error: "Server config error" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const id = (body.id ?? "").trim();
  const action = body.action as string;

  if (!id || !action) {
    return NextResponse.json({ ok: false, error: "id と action は必須です。" }, { status: 400 });
  }

  if (action === "deactivate") {
    // ban_duration で無効化（実質的な無効化）
    const { error } = await client.auth.admin.updateUserById(id, {
      ban_duration: "876600h", // 100年
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "activate") {
    const { error } = await client.auth.admin.updateUserById(id, {
      ban_duration: "none",
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "reset_password") {
    const newPassword = generatePassword();
    const { error } = await client.auth.admin.updateUserById(id, {
      password: newPassword,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data: { newPassword } });
  }

  return NextResponse.json({ ok: false, error: "不明な action です。" }, { status: 400 });
}
