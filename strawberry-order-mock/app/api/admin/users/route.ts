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
  name: string | null;
  email: string | null;
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
      "[/api/admin/users] supabaseAdmin is null. Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."
    );
    return null;
  }
  return supabaseAdmin;
}

// GET: 一覧取得
export async function GET() {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 }
    );
  }

  try {
    const { data: agenciesData, error: agenciesError } = await client
      .from("agencies")
      .select("id, name, code, created_at")
      .order("created_at", { ascending: true });

    if (agenciesError) {
      console.error("[/api/admin/users GET] agencies error:", agenciesError);
      return NextResponse.json(
        { error: `代理店一覧の取得に失敗しました: ${agenciesError.message}` },
        { status: 500 }
      );
    }

    const agencies = (agenciesData ?? []) as AgencyRow[];

    const { data: profilesData, error: profilesError } = await client
      .from("profiles")
      .select("id, name, email, role, agency_id, created_at")
      .order("created_at", { ascending: true });

    if (profilesError) {
      console.error("[/api/admin/users GET] profiles error:", profilesError);
      return NextResponse.json(
        { error: `ユーザー一覧の取得に失敗しました: ${profilesError.message}` },
        { status: 500 }
      );
    }

    const profiles = (profilesData ?? []) as ProfileRow[];

    const users: AdminUser[] = profiles.map((p) => {
      const agency =
        p.agency_id != null
          ? agencies.find((a) => a.id === p.agency_id) ?? null
          : null;

      return {
        id: p.id,
        name: p.name ?? "",
        email: p.email ?? "",
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
      { status: 500 }
    );
  }
}

// POST: ユーザー作成
export async function POST(request: NextRequest) {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 }
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
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "メールアドレスが入力されていません。" },
        { status: 400 }
      );
    }

    const allowedRoles: Role[] = ["admin", "agency"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "不正なロールが指定されています。" },
        { status: 400 }
      );
    }

    // agency ロールの場合、既存代理店 or 新規代理店のいずれか必須
    if (role === "agency" && !agencyId && !newAgencyName) {
      return NextResponse.json(
        {
          error:
            "代理店ユーザーの場合、所属代理店か新しい代理店名を入力してください。",
        },
        { status: 400 }
      );
    }

    // 必要なら新規代理店の作成
    if (!agencyId && newAgencyName) {
      const { data: insertedAgency, error: insertAgencyError } = await client
        .from("agencies")
        .insert({
          name: newAgencyName,
          code: null,
        })
        .select("id, name, code, created_at")
        .single();

      if (insertAgencyError) {
        console.error(
          "[/api/admin/users POST] insert agency error:",
          insertAgencyError
        );
        return NextResponse.json(
          { error: `代理店の作成に失敗しました: ${insertAgencyError.message}` },
          { status: 500 }
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
        { status: 500 }
      );
    }

    const authUser = authData.user;

    // profiles へ紐付けレコード作成
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .insert({
        id: authUser.id,
        name,
        email,
        role,
        agency_id: agencyId,
      })
      .select("id, name, email, role, agency_id, created_at")
      .single();

    if (profileError || !profile) {
      console.error(
        "[/api/admin/users POST] insert profile error:",
        profileError
      );
      return NextResponse.json(
        { error: `プロフィール作成に失敗しました: ${profileError?.message}` },
        { status: 500 }
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
        agenciesError
      );
    }

    const agencies = (agenciesData ?? []) as AgencyRow[];

    const agency =
      profile.agency_id != null
        ? agencies.find((a) => a.id === profile.agency_id) ?? null
        : null;

    const user: AdminUser = {
      id: profile.id,
      name: profile.name ?? "",
      email: profile.email ?? "",
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
      { status: 500 }
    );
  }
}
