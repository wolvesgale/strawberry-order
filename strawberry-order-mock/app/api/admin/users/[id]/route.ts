// app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

type Role = "admin" | "agency";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = params.id;

  try {
    const admin = supabaseAdmin;
    if (!admin) {
      console.error(
        "[PATCH /api/admin/users/:id] Supabase admin client is not configured",
      );
      return NextResponse.json(
        { error: "Supabase admin client が設定されていません。" },
        { status: 500 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      role?: Role;
      agencyId?: string | null;
    };

    const { role, agencyId } = body;

    if (!role) {
      return NextResponse.json(
        { error: "role は必須です。" },
        { status: 400 },
      );
    }

    const updates: { role: Role; agency_id: string | null } = {
      role,
      agency_id: null,
    };

    if (role === "agency") {
      if (!agencyId) {
        return NextResponse.json(
          { error: "代理店ユーザーには所属代理店が必須です。" },
          { status: 400 },
        );
      }
      updates.agency_id = agencyId;
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", userId); // ★ user_id ではなく id

    if (profileError) {
      console.error(
        "[PATCH /api/admin/users/:id] profiles update error",
        profileError,
      );
      return NextResponse.json(
        { error: "プロフィールの更新に失敗しました。" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PATCH /api/admin/users/:id] unexpected error", e);
    return NextResponse.json(
      { error: "予期せぬエラーが発生しました。" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = params.id;

  try {
    const admin = supabaseAdmin;
    if (!admin) {
      console.error(
        "[DELETE /api/admin/users/:id] Supabase admin client is not configured",
      );
      return NextResponse.json(
        { error: "Supabase admin client が設定されていません。" },
        { status: 500 },
      );
    }

    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", userId); // ★ ここも id

    if (profileError) {
      console.error(
        "[DELETE /api/admin/users/:id] profiles delete error",
        profileError,
      );
      return NextResponse.json(
        { error: "プロフィール削除時にエラーが発生しました。" },
        { status: 500 },
      );
    }

    const { error: authError } = await admin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error(
        "[DELETE /api/admin/users/:id] auth deleteUser error",
        authError,
      );
      return NextResponse.json(
        { error: "認証ユーザー削除時にエラーが発生しました。" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/admin/users/:id] unexpected error", e);
    return NextResponse.json(
      { error: "予期せぬエラーが発生しました。" },
      { status: 500 },
    );
  }
}
