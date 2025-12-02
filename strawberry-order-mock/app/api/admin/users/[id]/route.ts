// app/api/admin/users/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

type Role = "admin" | "agency";

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase admin client が設定されていません。" },
      { status: 500 }
    );
  }

  const userId = context.params.id;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      role?: Role;
      agencyId?: string | null;
    };

    const role = body.role;
    const agencyId = body.agencyId ?? null;

    if (!role) {
      return NextResponse.json(
        { error: "role は必須です。" },
        { status: 400 }
      );
    }

    if (role === "agency" && !agencyId) {
      return NextResponse.json(
        { error: "代理店ユーザーには所属代理店が必須です。" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        role,
        agency_id: role === "agency" ? agencyId : null,
      })
      .eq("id", userId);

    if (updateError) {
      console.error(
        "[PATCH /api/admin/users/:id] profile update error",
        updateError
      );
      return NextResponse.json(
        { error: "プロフィール更新中にエラーが発生しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PATCH /api/admin/users/:id] unexpected error", e);
    return NextResponse.json(
      { error: "プロフィール更新中に予期しないエラーが発生しました。" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase admin client が設定されていません。" },
      { status: 500 }
    );
  }

  const userId = context.params.id;

  try {
    const { error: authError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error(
        "[DELETE /api/admin/users/:id] auth delete error",
        authError
      );
      return NextResponse.json(
        { error: "認証ユーザーの削除に失敗しました。" },
        { status: 500 }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error(
        "[DELETE /api/admin/users/:id] profile delete error",
        profileError
      );
      return NextResponse.json(
        { error: "プロフィールの削除に失敗しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/admin/users/:id] unexpected error", e);
    return NextResponse.json(
      { error: "ユーザー削除中に予期しないエラーが発生しました。" },
      { status: 500 }
    );
  }
}
