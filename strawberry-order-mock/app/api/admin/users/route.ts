// app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type Role = "admin" | "agency";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase admin client が設定されていません。" },
      { status: 500 }
    );
  }

  try {
    // auth.users
    const { data: usersResult, error: usersError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      console.error("[GET /api/admin/users] listUsers error", usersError);
      return NextResponse.json(
        { error: "認証ユーザー一覧の取得に失敗しました。" },
        { status: 500 }
      );
    }

    // profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, agency_id");

    if (profilesError) {
      console.error("[GET /api/admin/users] profiles error", profilesError);
      return NextResponse.json(
        { error: "プロフィール情報の取得に失敗しました。" },
        { status: 500 }
      );
    }

    // agencies
    const { data: agencies, error: agenciesError } = await supabaseAdmin
      .from("agencies")
      .select("id, name, code")
      .order("name", { ascending: true });

    if (agenciesError) {
      console.error("[GET /api/admin/users] agencies error", agenciesError);
      return NextResponse.json(
        { error: "代理店情報の取得に失敗しました。" },
        { status: 500 }
      );
    }

    const users =
      usersResult?.users.map((u) => {
        const profile = profiles?.find((p) => p.id === u.id) ?? null;
        const agency =
          profile?.agency_id != null
            ? agencies?.find((a) => a.id === profile.agency_id) ?? null
            : null;

        return {
          id: u.id,
          email: u.email ?? "",
          role: (profile?.role as Role | null) ?? "admin",
          agencyId: profile?.agency_id ?? null,
          agencyName: agency?.name ?? null,
          agencyCode: agency?.code ?? null,
        };
      }) ?? [];

    return NextResponse.json({
      users,
      agencies: agencies ?? [],
    });
  } catch (e) {
    console.error("[GET /api/admin/users] unexpected error", e);
    return NextResponse.json(
      { error: "ユーザー一覧の取得中に予期しないエラーが発生しました。" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase admin client が設定されていません。" },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      role?: Role;
      agencyId?: string | null;
    };

    const email = body.email?.trim() ?? "";
    const password = body.password?.trim() ?? "";
    const role: Role = body.role ?? "agency";
    const agencyId = body.agencyId ?? null;

    if (!email || !password) {
      return NextResponse.json(
        { error: "メールアドレスと初期パスワードは必須です。" },
        { status: 400 }
      );
    }

    if (role === "agency" && !agencyId) {
      return NextResponse.json(
        { error: "代理店ユーザーを作成する場合は所属代理店を選択してください。" },
        { status: 400 }
      );
    }

    // auth.users に作成
    const { data: createResult, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError || !createResult?.user) {
      console.error("[POST /api/admin/users] createUser error", createError);
      return NextResponse.json(
        { error: "認証ユーザーの作成に失敗しました。" },
        { status: 500 }
      );
    }

    const user = createResult.user;

    // profiles にも登録
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email,
        role,
        agency_id: role === "agency" ? agencyId : null,
      });

    if (profileError) {
      console.error("[POST /api/admin/users] profile upsert error", profileError);
      return NextResponse.json(
        { error: "プロフィール情報の保存に失敗しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/admin/users] unexpected error", e);
    return NextResponse.json(
      { error: "ユーザー作成中に予期しないエラーが発生しました。" },
      { status: 500 }
    );
  }
}
