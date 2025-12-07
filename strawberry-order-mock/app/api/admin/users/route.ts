// app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type Agency = {
  id: string;
  name: string;
  code: string | null;
};

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: "admin" | "agency";
  agencyId: string | null;
  createdAt: string;
};

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 16) || "agency"
  );
}

async function findOrCreateAgency(
  admin: NonNullable<typeof supabaseAdmin>,
  name?: string | null,
): Promise<Agency | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  // 既存チェック
  const { data: existing, error: existingError } = await admin
    .from("agencies")
    .select("id, name, code")
    .eq("name", trimmed)
    .maybeSingle();

  if (existingError) {
    console.error("findOrCreateAgency: select error", existingError);
    throw existingError;
  }

  if (existing) return existing as Agency;

  // 新規作成
  const { data: created, error: insertError } = await admin
    .from("agencies")
    .insert({
      name: trimmed,
      code: slugify(trimmed),
    })
    .select("id, name, code")
    .single();

  if (insertError) {
    console.error("findOrCreateAgency: insert error", insertError);
    throw insertError;
  }

  return created as Agency;
}

// ===== GET: ユーザー & 代理店一覧 =====

export async function GET() {
  try {
    const admin = supabaseAdmin;
    if (!admin) {
      console.error("GET /admin/users: supabaseAdmin is not configured");
      return NextResponse.json(
        {
          error:
            "Supabase admin client が設定されていません（サービスロールキーが未設定の可能性があります）。",
        },
        { status: 500 },
      );
    }

    // 代理店一覧
    const { data: agencies, error: agenciesError } = await admin
      .from("agencies")
      .select("id, name, code")
      .order("name", { ascending: true });

    if (agenciesError) {
      console.error("GET /admin/users: agencies error", agenciesError);
      return NextResponse.json(
        { error: "代理店一覧の取得に失敗しました。" },
        { status: 500 },
      );
    }

    // auth.users 一覧
    const { data: usersData, error: usersError } =
      await admin.auth.admin.listUsers();

    if (usersError) {
      console.error("GET /admin/users: listUsers error", usersError);
      return NextResponse.json(
        { error: "ユーザー一覧の取得に失敗しました。" },
        { status: 500 },
      );
    }

    const users = usersData?.users ?? [];
    const userIds = users.map((u) => u.id);

    // profiles 一括取得（id / role / agency_id）
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, role, agency_id")
      .in("id", userIds.length > 0 ? userIds : ["dummy"]); // 空配列ガード

    if (profilesError) {
      console.error("GET /admin/users: profiles error", profilesError);
      return NextResponse.json(
        { error: "プロフィール情報の取得に失敗しました。" },
        { status: 500 },
      );
    }

    const profileMap = new Map<
      string,
      { id: string; role: string | null; agency_id: string | null }
    >();
    (profiles ?? []).forEach((p) => {
      profileMap.set(p.id as string, p as any);
    });

    const adminUsers: AdminUser[] = users.map((u) => {
      const profile = profileMap.get(u.id);
      const role =
        profile?.role === "admin" || profile?.role === "agency"
          ? (profile.role as "admin" | "agency")
          : "agency";

      const nameFromMeta =
        (u.user_metadata as any)?.name ??
        (u.user_metadata as any)?.full_name ??
        null;
      const fallbackName =
        u.email?.split("@")[0] ?? (role === "admin" ? "管理者" : "ユーザー");

      return {
        id: u.id,
        name: nameFromMeta ?? fallbackName,
        email: u.email ?? null,
        role,
        agencyId: (profile?.agency_id as string | null) ?? null,
        createdAt: u.created_at ?? new Date().toISOString(),
      };
    });

    return NextResponse.json({
      agencies: (agencies ?? []) as Agency[],
      users: adminUsers,
    });
  } catch (error) {
    console.error("GET /admin/users: unexpected error", error);
    return NextResponse.json(
      { error: "ユーザー一覧の取得に失敗しました。" },
      { status: 500 },
    );
  }
}

// ===== POST: ユーザー新規作成 =====

export async function POST(req: Request) {
  try {
    const admin = supabaseAdmin;
    if (!admin) {
      console.error("POST /admin/users: supabaseAdmin is not configured");
      return NextResponse.json(
        {
          error:
            "Supabase admin client が設定されていません（サービスロールキーが未設定の可能性があります）。",
        },
        { status: 500 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      role?: "admin" | "agency";
      agencyId?: string | null;
      newAgencyName?: string | null;
    };

    const name = body.name?.trim();
    const email = body.email?.trim();
    const role = body.role;

    if (!name || !email || (role !== "admin" && role !== "agency")) {
      return NextResponse.json(
        { error: "名前、メール、ロールは必須です。" },
        { status: 400 },
      );
    }

    // 代理店決定
    let agencyIdToUse: string | null | undefined = body.agencyId ?? null;
    const createdAgency = await findOrCreateAgency(
      admin,
      body.newAgencyName,
    );

    if (createdAgency) {
      agencyIdToUse = createdAgency.id;
    } else if (agencyIdToUse) {
      const { data: existsAgency, error: existsError } = await admin
        .from("agencies")
        .select("id")
        .eq("id", agencyIdToUse)
        .maybeSingle();

      if (existsError) {
        console.error("POST /admin/users: agencies exists error", existsError);
        return NextResponse.json(
          { error: "代理店の確認に失敗しました。" },
          { status: 500 },
        );
      }

      if (!existsAgency) {
        return NextResponse.json(
          { error: "指定された代理店が存在しません。" },
          { status: 400 },
        );
      }
    }

    // 仮パスワード生成
    const tempPassword =
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 10);

    // auth.users 作成
    const { data: createdUserData, error: createUserError } =
      await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name,
        },
      });

    if (createUserError || !createdUserData?.user) {
      console.error("POST /admin/users: createUser error", createUserError);
      return NextResponse.json(
        { error: "認証ユーザーの作成に失敗しました。" },
        { status: 500 },
      );
    }

    const user = createdUserData.user;

    // profiles 作成（id / role / agency_id のみ）
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .insert({
        id: user.id,
        role,
        agency_id: agencyIdToUse ?? null,
      })
      .select("id, role, agency_id")
      .single();

    if (profileError) {
      console.error("POST /admin/users: profile insert error", profileError);
      // ロールバック
      await admin.auth.admin.deleteUser(user.id).catch((e) => {
        console.error("POST /admin/users: rollback deleteUser error", e);
      });
      return NextResponse.json(
        { error: "プロフィールの作成に失敗しました。" },
        { status: 500 },
      );
    }

    const adminUser: AdminUser = {
      id: user.id,
      name,
      email: user.email ?? email,
      role,
      agencyId: (profile.agency_id as string | null) ?? null,
      createdAt: user.created_at ?? new Date().toISOString(),
    };

    const { data: agencies } = await admin
      .from("agencies")
      .select("id, name, code")
      .order("name", { ascending: true });

    return NextResponse.json(
      { user: adminUser, agencies: (agencies ?? []) as Agency[] },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /admin/users: unexpected error", error);
    return NextResponse.json(
      { error: "ユーザー作成に失敗しました。" },
      { status: 500 },
    );
  }
}

// ===== PATCH: ユーザー更新 =====

export async function PATCH(req: Request) {
  try {
    const admin = supabaseAdmin;
    if (!admin) {
      console.error("PATCH /admin/users: supabaseAdmin is not configured");
      return NextResponse.json(
        {
          error:
            "Supabase admin client が設定されていません（サービスロールキーが未設定の可能性があります）。",
        },
        { status: 500 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      name?: string; // 今回は profiles には保存しない
      email?: string;
      role?: "admin" | "agency";
      agencyId?: string | null;
      newAgencyName?: string | null;
    };

    if (!body.id) {
      return NextResponse.json(
        { error: "ユーザーIDが指定されていません。" },
        { status: 400 },
      );
    }

    const userId = body.id;

    // ユーザー存在確認
    const { data: userData, error: getUserError } =
      await admin.auth.admin.getUserById(userId);

    if (getUserError || !userData?.user) {
      console.error("PATCH /admin/users: getUser error", getUserError);
      return NextResponse.json(
        { error: "ユーザーが見つかりません。" },
        { status: 404 },
      );
    }

    const user = userData.user;

    // 代理店決定
    const createdAgency = await findOrCreateAgency(
      admin,
      body.newAgencyName,
    );
    let agencyIdToUse = body.agencyId ?? null;

    if (createdAgency) {
      agencyIdToUse = createdAgency.id;
    } else if (agencyIdToUse) {
      const { data: existsAgency, error: existsError } = await admin
        .from("agencies")
        .select("id")
        .eq("id", agencyIdToUse)
        .maybeSingle();

      if (existsError) {
        console.error("PATCH /admin/users: agencies exists error", existsError);
        return NextResponse.json(
          { error: "代理店の確認に失敗しました。" },
          { status: 500 },
        );
      }

      if (!existsAgency) {
        return NextResponse.json(
          { error: "指定された代理店が存在しません。" },
          { status: 400 },
        );
      }
    }

    // profiles 更新（role / agency_id）
    const profileUpdate: Record<string, unknown> = {};
    if (body.role === "admin" || body.role === "agency") {
      profileUpdate.role = body.role;
    }
    if (agencyIdToUse !== undefined) {
      profileUpdate.agency_id = agencyIdToUse;
    }

    const { data: updatedProfile, error: profileError } = await admin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId)
      .select("id, role, agency_id")
      .maybeSingle();

    if (profileError) {
      console.error("PATCH /admin/users: profile update error", profileError);
      return NextResponse.json(
        { error: "プロフィールの更新に失敗しました。" },
        { status: 500 },
      );
    }

    // auth.users の email 更新（必要なら）
    if (body.email && body.email.trim() && body.email.trim() !== user.email) {
      const { error: updateUserError } =
        await admin.auth.admin.updateUserById(userId, {
          email: body.email.trim(),
        });

      if (updateUserError) {
        console.error(
          "PATCH /admin/users: updateUser email error",
          updateUserError,
        );
        return NextResponse.json(
          { error: "メールアドレスの更新に失敗しました。" },
          { status: 500 },
        );
      }
    }

    const role =
      (updatedProfile?.role as "admin" | "agency" | null) ??
      (body.role ?? "agency");

    const adminUser: AdminUser = {
      id: userId,
      name:
        body.name ??
        (user.user_metadata as any)?.name ??
        (user.user_metadata as any)?.full_name ??
        user.email?.split("@")[0] ??
        null,
      email: body.email ?? user.email ?? null,
      role,
      agencyId: (updatedProfile?.agency_id as string | null) ?? null,
      createdAt: user.created_at ?? new Date().toISOString(),
    };

    const { data: agencies } = await admin
      .from("agencies")
      .select("id, name, code")
      .order("name", { ascending: true });

    return NextResponse.json({
      user: adminUser,
      agencies: (agencies ?? []) as Agency[],
    });
  } catch (error) {
    console.error("PATCH /admin/users: unexpected error", error);
    return NextResponse.json(
      { error: "ユーザー更新に失敗しました。" },
      { status: 500 },
    );
  }
}
