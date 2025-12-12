// strawberry-order-mock/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Role = "admin" | "agency";

type AgencyRow = {
  id: string;
  name: string;
  code: string | null;
  created_at?: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: string | null;
  agency_id: string | null;
  created_at: string | null;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  agencyId: string | null;
  agencyName: string | null;
  createdAt: string;
};

type AdminUsersApiResponse = {
  agencies: AgencyRow[];
  users: AdminUser[];
};

function ensureSupabase() {
  if (!supabaseAdmin) {
    console.error(
      "[/api/admin/users] supabaseAdmin is null. Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.",
    );
    return null;
  }
  return supabaseAdmin;
}

/**
 * GET: ユーザー一覧 + 代理店一覧取得
 */
export async function GET() {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 },
    );
  }

  try {
    // ① 代理店一覧
    const { data: agenciesData, error: agenciesError } = await client
      .from("agencies")
      .select("id, name, code, created_at")
      .order("created_at", { ascending: true });

    if (agenciesError) {
      console.error("[/api/admin/users GET] agencies error:", agenciesError);
      return NextResponse.json(
        { error: `代理店一覧の取得に失敗しました: ${agenciesError.message}` },
        { status: 500 },
      );
    }

    const agencies = (agenciesData ?? []) as AgencyRow[];

    // ② profiles（display_name を利用）
    const { data: profilesData, error: profilesError } = await client
      .from("profiles")
      .select("id, display_name, role, agency_id, created_at")
      .order("created_at", { ascending: true });

    if (profilesError) {
      console.error("[/api/admin/users GET] profiles error:", profilesError);
      return NextResponse.json(
        { error: `ユーザー一覧の取得に失敗しました: ${profilesError.message}` },
        { status: 500 },
      );
    }

    const profiles = (profilesData ?? []) as ProfileRow[];

    // ③ Auth ユーザー（メールアドレス取得用）
    const { data: authData, error: authError } =
      await client.auth.admin.listUsers();

    if (authError) {
      console.error("[/api/admin/users GET] auth listUsers error:", authError);
      return NextResponse.json(
        { error: "ユーザー一覧の取得に失敗しました。(auth)" },
        { status: 500 },
      );
    }

    const emailById = new Map<string, string>();
    for (const u of authData?.users ?? []) {
      emailById.set(u.id, u.email ?? "");
    }

    // ④ profiles × agencies × auth.users をマージ
    const users: AdminUser[] = profiles.map((p) => {
      const agency =
        p.agency_id != null
          ? agencies.find((a) => a.id === p.agency_id) ?? null
          : null;

      const email = emailById.get(p.id) ?? "";

      return {
        id: p.id,
        name: p.display_name ?? "",
        email,
        role: (p.role as Role) ?? "agency",
        agencyId: p.agency_id,
        agencyName: agency?.name ?? null,
        createdAt: p.created_at ?? new Date().toISOString(),
      };
    });

    const resp: AdminUsersApiResponse = {
      agencies,
      users,
    };

    return NextResponse.json(resp);
  } catch (error: any) {
    console.error("[/api/admin/users GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "ユーザー情報の取得中にエラーが発生しました。" },
      { status: 500 },
    );
  }
}

/**
 * POST: ユーザー作成
 * 期待ボディ:
 * {
 *   name: string;
 *   email: string;
 *   role: "admin" | "agency";
 *   agencyId?: string | null;
 *   newAgencyName?: string | null;
 * }
 */
export async function POST(request: NextRequest) {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      role?: Role;
      agencyId?: string | null;
      newAgencyName?: string | null;
    };

    const name = body.name?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const role = body.role ?? "agency";
    let agencyId = body.agencyId ?? null;
    const newAgencyName = body.newAgencyName?.trim() ?? "";

    if (!name) {
      return NextResponse.json(
        { error: "名前が入力されていません。" },
        { status: 400 },
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "メールアドレスが入力されていません。" },
        { status: 400 },
      );
    }

    const allowedRoles: Role[] = ["admin", "agency"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "不正なロールが指定されています。" },
        { status: 400 },
      );
    }

    // agency ロールの場合、既存代理店 or 新規代理店のいずれか必須
    if (role === "agency" && !agencyId && !newAgencyName) {
      return NextResponse.json(
        {
          error:
            "代理店ユーザーの場合、所属代理店か新しい代理店名を入力してください。",
        },
        { status: 400 },
      );
    }

    // 必要なら新規代理店の作成
    if (!agencyId && newAgencyName) {
      const safeCode = newAgencyName; // そのまま code に採用（NOT NULL 対策）

      const { data: insertedAgency, error: insertAgencyError } = await client
        .from("agencies")
        .insert({
          name: newAgencyName,
          code: safeCode,
        })
        .select("id, name, code, created_at")
        .single();

      if (insertAgencyError) {
        console.error(
          "[/api/admin/users POST] insert agency error:",
          insertAgencyError,
        );
        return NextResponse.json(
          { error: `代理店の作成に失敗しました: ${insertAgencyError.message}` },
          { status: 500 },
        );
      }

      agencyId = insertedAgency?.id ?? null;
    }

    // Supabase Auth ユーザー作成
    const initialPassword =
      process.env.INITIAL_USER_PASSWORD || "Ichigo-2025!";

    const { data: authData, error: authError } =
      await client.auth.admin.createUser({
        email,
        password: initialPassword,
        email_confirm: true,
      });

    if (authError || !authData?.user) {
      console.error("[/api/admin/users POST] createUser error:", authError);
      return NextResponse.json(
        { error: `Authユーザーの作成に失敗しました: ${authError?.message}` },
        { status: 500 },
      );
    }

    const authUser = authData.user;

    // profiles へ紐付けレコード作成（display_name を使用）
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .insert({
        id: authUser.id,
        display_name: name,
        role,
        agency_id: agencyId,
      })
      .select("id, display_name, role, agency_id, created_at")
      .single();

    if (profileError || !profile) {
      console.error(
        "[/api/admin/users POST] insert profile error:",
        profileError,
      );
      return NextResponse.json(
        { error: `プロフィール作成に失敗しました: ${profileError?.message}` },
        { status: 500 },
      );
    }

    // 最新の代理店一覧も返す（画面側のプルダウン更新用）
    const { data: agenciesData, error: agenciesError } = await client
      .from("agencies")
      .select("id, name, code, created_at")
      .order("created_at", { ascending: true });

    if (agenciesError) {
      console.error(
        "[/api/admin/users POST] agencies reload error:",
        agenciesError,
      );
    }

    const agencies = (agenciesData ?? []) as AgencyRow[];

    const agency =
      profile.agency_id != null
        ? agencies.find((a) => a.id === profile.agency_id) ?? null
        : null;

    const user: AdminUser = {
      id: profile.id,
      name: profile.display_name ?? "",
      email,
      role: (profile.role as Role) ?? "agency",
      agencyId: profile.agency_id,
      agencyName: agency?.name ?? null,
      createdAt: profile.created_at ?? new Date().toISOString(),
    };

    const respBody = {
      ok: true,
      user,
      agencies,
    };

    return NextResponse.json(respBody, { status: 201 });
  } catch (error: any) {
    console.error("[/api/admin/users POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "ユーザー作成中にエラーが発生しました。" },
      { status: 500 },
    );
  }
}

/**
 * PATCH: 既存ユーザーの更新（名前 / ロール / 代理店）
 * 期待ボディ:
 * {
 *   id: string;
 *   name?: string;
 *   role?: "admin" | "agency";
 *   agencyId?: string | null;
 *   newAgencyName?: string | null;
 * }
 */
export async function PATCH(request: NextRequest) {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      role?: Role;
      agencyId?: string | null;
      newAgencyName?: string | null;
    };

    const id = body.id;
    const name = body.name?.trim();
    const role = body.role;
    let agencyId = body.agencyId ?? null;
    const newAgencyName = body.newAgencyName?.trim() ?? "";

    if (!id) {
      return NextResponse.json(
        { error: "更新対象のユーザーIDが指定されていません。" },
        { status: 400 },
      );
    }

    if (role && !["admin", "agency"].includes(role)) {
      return NextResponse.json(
        { error: "不正なロールが指定されています。" },
        { status: 400 },
      );
    }

    // agency ロールに変更する場合、代理店必須
    if (role === "agency" && !agencyId && !newAgencyName) {
      return NextResponse.json(
        {
          error:
            "代理店ユーザーの場合、所属代理店か新しい代理店名を入力してください。",
        },
        { status: 400 },
      );
    }

    // 必要なら新規代理店作成
    if (!agencyId && newAgencyName) {
      const safeCode = newAgencyName;

      const { data: insertedAgency, error: insertAgencyError } = await client
        .from("agencies")
        .insert({
          name: newAgencyName,
          code: safeCode,
        })
        .select("id, name, code, created_at")
        .single();

      if (insertAgencyError) {
        console.error(
          "[/api/admin/users PATCH] insert agency error:",
          insertAgencyError,
        );
        return NextResponse.json(
          { error: `代理店の作成に失敗しました: ${insertAgencyError.message}` },
          { status: 500 },
        );
      }

      agencyId = insertedAgency?.id ?? null;
    }

    const updates: any = {};
    if (typeof name === "string") {
      updates.display_name = name;
    }
    if (role) {
      updates.role = role;
    }
    if (body.agencyId !== undefined || newAgencyName) {
      updates.agency_id = agencyId;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "更新項目が指定されていません。" },
        { status: 400 },
      );
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select("id, display_name, role, agency_id, created_at")
      .single();

    if (profileError || !profile) {
      console.error(
        "[/api/admin/users PATCH] update profile error:",
        profileError,
      );
      return NextResponse.json(
        { error: `プロフィール更新に失敗しました: ${profileError?.message}` },
        { status: 500 },
      );
    }

    // 最新代理店とメール情報を取得
    const { data: agenciesData, error: agenciesError } = await client
      .from("agencies")
      .select("id, name, code, created_at")
      .order("created_at", { ascending: true });

    if (agenciesError) {
      console.error(
        "[/api/admin/users PATCH] agencies reload error:",
        agenciesError,
      );
    }

    const agencies = (agenciesData ?? []) as AgencyRow[];

    let email = "";
    try {
      const { data: authUser, error: authError } =
        await client.auth.admin.getUserById(profile.id);
      if (!authError && authUser?.user) {
        email = authUser.user.email ?? "";
      } else if (authError) {
        console.error(
          "[/api/admin/users PATCH] getUserById error:",
          authError,
        );
      }
    } catch (e) {
      console.error("[/api/admin/users PATCH] getUserById exception:", e);
    }

    const agency =
      profile.agency_id != null
        ? agencies.find((a) => a.id === profile.agency_id) ?? null
        : null;

    const user: AdminUser = {
      id: profile.id,
      name: profile.display_name ?? "",
      email,
      role: (profile.role as Role) ?? "agency",
      agencyId: profile.agency_id,
      agencyName: agency?.name ?? null,
      createdAt: profile.created_at ?? new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, user, agencies });
  } catch (error: any) {
    console.error("[/api/admin/users PATCH] Unexpected error:", error);
    return NextResponse.json(
      { error: "ユーザー更新中にエラーが発生しました。" },
      { status: 500 },
    );
  }
}

/**
 * DELETE: ユーザー削除（Auth + profiles）
 * - クエリ (?id=...) か JSON ボディ { id } のどちらかでIDを受け取る
 */
export async function DELETE(request: NextRequest) {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 },
    );
  }

  try {
    // id は query または body のどちらでもOKにしておく
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = (await request.json().catch(() => null)) as
          | { id?: string }
          | null;
        if (body?.id) {
          id = body.id;
        }
      } catch {
        // ignore
      }
    }

    if (!id) {
      return NextResponse.json(
        { error: "削除対象のユーザーIDが指定されていません。" },
        { status: 400 },
      );
    }

    // 先に Auth ユーザーを削除
    try {
      const { error: authError } = await client.auth.admin.deleteUser(id);
      if (authError) {
        console.error(
          "[/api/admin/users DELETE] deleteUser error:",
          authError,
        );
      }
    } catch (e) {
      console.error("[/api/admin/users DELETE] deleteUser exception:", e);
    }

    // profiles からも削除
    const { error: profileError } = await client
      .from("profiles")
      .delete()
      .eq("id", id);

    if (profileError) {
      console.error(
        "[/api/admin/users DELETE] delete profile error:",
        profileError,
      );
      return NextResponse.json(
        { error: `プロフィール削除に失敗しました: ${profileError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[/api/admin/users DELETE] Unexpected error:", error);
    return NextResponse.json(
      { error: "ユーザー削除中にエラーが発生しました。" },
      { status: 500 },
    );
  }
}
