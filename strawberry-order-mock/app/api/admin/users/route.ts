// app/api/admin/users/route.ts
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

// 共通: 代理店一覧取得
async function loadAgencies(client: any): Promise<AgencyRow[]> {
  const { data, error } = await client
    .from("agencies")
    .select("id, name, code, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[/api/admin/users] loadAgencies error:", error);
    throw new Error(`代理店一覧の取得に失敗しました: ${error.message}`);
  }

  return (data ?? []) as AgencyRow[];
}

// 共通: Auth ユーザーの email マップ
async function loadAuthEmailMap(client: any): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  const { data, error } = await client.auth.admin.listUsers();
  if (error) {
    console.error("[/api/admin/users] listUsers error:", error);
    throw new Error("Authユーザー一覧の取得に失敗しました。");
  }

  for (const u of data?.users ?? []) {
    map.set(u.id, u.email ?? "");
  }

  return map;
}

// 共通: AdminUser 1件に組み立て
function buildAdminUser(
  profile: ProfileRow,
  agencies: AgencyRow[],
  email: string,
): AdminUser {
  const agency =
    profile.agency_id != null
      ? agencies.find((a) => a.id === profile.agency_id) ?? null
      : null;

  return {
    id: profile.id,
    name: profile.display_name ?? "",
    email,
    role: (profile.role as Role) ?? "agency",
    agencyId: profile.agency_id,
    agencyName: agency?.name ?? null,
    createdAt: profile.created_at ?? new Date().toISOString(),
  };
}

// GET: 一覧取得
export async function GET() {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 },
    );
  }

  try {
    const agencies = await loadAgencies(client);

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
    const emailMap = await loadAuthEmailMap(client);

    const users: AdminUser[] = profiles.map((p) =>
      buildAdminUser(p, agencies, emailMap.get(p.id) ?? ""),
    );

    const resp: AdminUsersApiResponse = {
      agencies,
      users,
    };

    return NextResponse.json(resp);
  } catch (error) {
    console.error("[/api/admin/users GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "ユーザー情報の取得中にエラーが発生しました。" },
      { status: 500 },
    );
  }
}

// POST: ユーザー作成
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
      const safeCode = newAgencyName; // そのまま code に入れる（NOT NULL 対策）

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
          {
            error: `代理店の作成に失敗しました: ${insertAgencyError.message}`,
          },
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

    const agencies = await loadAgencies(client);

    const user: AdminUser = buildAdminUser(
      profile as ProfileRow,
      agencies,
      email,
    );

    const respBody = {
      ok: true,
      user,
      agencies,
    };

    return NextResponse.json(respBody, { status: 201 });
  } catch (error) {
    console.error("[/api/admin/users POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "ユーザー作成中にエラーが発生しました。" },
      { status: 500 },
    );
  }
}

// PUT: ユーザー更新（名前 / ロール / 代理店）
export async function PUT(request: NextRequest) {
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

    const id = body.id?.trim();
    const name = body.name?.trim();
    const role = body.role;
    let agencyId = body.agencyId ?? null;
    const newAgencyName = body.newAgencyName?.trim() ?? "";

    if (!id) {
      return NextResponse.json(
        { error: "更新対象のユーザー ID が指定されていません。" },
        { status: 400 },
      );
    }

    const allowedRoles: Role[] = ["admin", "agency"];
    if (role && !allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "不正なロールが指定されています。" },
        { status: 400 },
      );
    }

    // agency ロールを指定している場合、新規 or 既存代理店が必要
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
          "[/api/admin/users PUT] insert agency error:",
          insertAgencyError,
        );
        return NextResponse.json(
          {
            error: `代理店の作成に失敗しました: ${insertAgencyError.message}`,
          },
          { status: 500 },
        );
      }

      agencyId = insertedAgency?.id ?? null;
    }

    // 更新内容の組み立て
    const updatePayload: any = {};
    if (typeof name === "string" && name.length > 0) {
      updatePayload.display_name = name;
    }
    if (role) {
      updatePayload.role = role;
    }
    if (agencyId !== undefined) {
      updatePayload.agency_id = agencyId;
    }

    const { data: profile, error: updateError } = await client
      .from("profiles")
      .update(updatePayload)
      .eq("id", id)
      .select("id, display_name, role, agency_id, created_at")
      .single();

    if (updateError || !profile) {
      console.error(
        "[/api/admin/users PUT] update profile error:",
        updateError,
      );
      return NextResponse.json(
        { error: `ユーザー情報の更新に失敗しました: ${updateError?.message}` },
        { status: 500 },
      );
    }

    const agencies = await loadAgencies(client);

    // email を取得
    let email = "";
    try {
      const { data: authUser, error: authError } =
        await client.auth.admin.getUserById(id);
      if (authError) {
        console.error(
          "[/api/admin/users PUT] getUserById error:",
          authError,
        );
      } else if (authUser?.user?.email) {
        email = authUser.user.email;
      }
    } catch (e) {
      console.error(
        "[/api/admin/users PUT] getUserById exception:",
        e,
      );
    }

    const user: AdminUser = buildAdminUser(
      profile as ProfileRow,
      agencies,
      email,
    );

    return NextResponse.json({ ok: true, user, agencies });
  } catch (error) {
    console.error("[/api/admin/users PUT] Unexpected error:", error);
    return NextResponse.json(
      { error: "ユーザー更新中にエラーが発生しました。" },
      { status: 500 },
    );
  }
}

// DELETE: ユーザー削除（profiles + Authユーザー）
export async function DELETE(request: NextRequest) {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as { id?: string };
    const id = body.id?.trim();

    if (!id) {
      return NextResponse.json(
        { error: "削除対象のユーザー ID が指定されていません。" },
        { status: 400 },
      );
    }

    // profiles を先に削除
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

    // Auth ユーザーを削除
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/admin/users DELETE] Unexpected error:", error);
    return NextResponse.json(
      { error: "ユーザー削除中にエラーが発生しました。" },
      { status: 500 },
    );
  }
}
