// strawberry-order-mock/app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Next.js 16 では context.params が Promise になる想定
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await context.params;

  const client = supabaseAdmin;
  if (!client) {
    console.error("[/api/admin/users/[id] DELETE] supabaseAdmin is null");
    return NextResponse.json(
      { error: "サーバー設定エラーが発生しました。" },
      { status: 500 }
    );
  }

  try {
    // Supabase Auth のユーザー削除（失敗しても致命的にはしない）
    try {
      // service role キー前提の管理 API
      // @ts-ignore
      await client.auth.admin.deleteUser(userId);
    } catch (e) {
      console.warn(
        "[/api/admin/users/[id] DELETE] auth.admin.deleteUser failed (続行します)",
        e
      );
    }

    // profiles テーブルから削除
    const { error } = await client.from("profiles").delete().eq("id", userId);
    if (error) {
      console.error(
        "[/api/admin/users/[id] DELETE] profiles delete error",
        error
      );
      return NextResponse.json(
        { error: "ユーザーの削除に失敗しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(
      "[/api/admin/users/[id] DELETE] unexpected error",
      e
    );
    return NextResponse.json(
      { error: e?.message ?? "ユーザーの削除中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
