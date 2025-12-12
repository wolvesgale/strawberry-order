import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Agency = {
  id: string;
  name: string;
  code: string | null;
};

type Profile = {
  id: string;
  display_name: string | null;
  role: "admin" | "agency" | null;
  agency_id: string | null;
  email?: string | null;
};

export type AdminUserListItem = {
  id: string;
  displayName: string;
  email?: string | null;
  role: "admin" | "agency";
  agencyId: string | null;
  agencyName: string | null;
};

type PostBody = {
  displayName?: string;
  email?: string;
  role?: "admin" | "agency";
  agencyId?: string | null;
};

type PutBody = {
  id?: string;
  displayName?: string;
  role?: "admin" | "agency";
  agencyId?: string | null;
};

type PatchBody = {
  id?: string;
  agencyId?: string | null;
  newAgencyName?: string | null;
};

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 24);
  const fallback = base || "agency";
  return `${fallback}-${crypto.randomUUID().slice(0, 8)}`;
}

function ensureSupabase() {
  if (!supabaseAdmin) {
    console.error(
      "[/api/admin/users] supabaseAdmin is null. Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."
    );
    return null;
  }
  return supabaseAdmin;
}

function mapProfilesToUsers(
  profiles: Profile[],
  agencies: Agency[],
  emails: Record<string, string | null>
): AdminUserListItem[] {
  return profiles
    .filter((p): p is Profile & { role: "admin" | "agency" } =>
      p.role === "admin" || p.role === "agency"
    )
    .map((p) => {
      const agency = agencies.find((a) => a.id === p.agency_id);
      return {
        id: p.id,
        displayName: p.display_name ?? "(名称未設定)",
        email: emails[p.id] ?? p.email ?? null,
        role: p.role,
        agencyId: p.agency_id,
        agencyName: agency?.name ?? null,
      } satisfies AdminUserListItem;
    });
}

async function fetchEmailsByProfileIds(ids: string[]) {
  const emails: Record<string, string | null> = {};
  const client = ensureSupabase();
  if (!client) return emails;

  for (const id of ids) {
    try {
      const { data, error } = await client.auth.admin.getUserById(id);
      if (error) {
        console.error("[/api/admin/users GET] auth fetch error", { id, error });
        emails[id] = null;
        continue;
      }
      emails[id] = data.user?.email ?? null;
    } catch (e) {
      console.error("[/api/admin/users GET] auth fetch unexpected", { id, e });
      emails[id] = null;
    }
  }

  return emails;
}

function generatePassword(length = 16) {
  return crypto.randomBytes(length).toString("base64url");
}

export async function GET() {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 }
    );
  }

  try {
    const [
      { data: agencyRows, error: agencyError },
      { data: profileRows, error: profileError },
    ] = await Promise.all([
      client.from("agencies").select("id, name, code"),
      client
        .from("profiles")
        .select("id, display_name, role, agency_id, email"),
    ]);

    if (agencyError) {
      console.error("[/api/admin/users GET] agencies error", agencyError);
      return NextResponse.json(
        { error: "代理店情報の取得に失敗しました。" },
        { status: 500 }
      );
    }

    if (profileError) {
      console.error("[/api/admin/users GET] profiles error", profileError);
      return NextResponse.json(
        { error: "ユーザー情報の取得に失敗しました。" },
        { status: 500 }
      );
    }

    const agencies = (agencyRows ?? []) as Agency[];
    const profiles = (profileRows ?? []) as Profile[];
    const emails = await fetchEmailsByProfileIds(profiles.map((p) => p.id));

    const users = mapProfilesToUsers(profiles, agencies, emails);

    return NextResponse.json({ agencies, users });
  } catch (error) {
    console.error("[/api/admin/users GET] unexpected error", error);
    return NextResponse.json(
      { error: "ユーザー情報の取得に失敗しました。" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as PostBody;
    const displayName = body.displayName?.trim();
    const email = body.email?.trim();
    const role = body.role;
    const agencyId = body.agencyId ?? null;

    if (!displayName || !email || !role) {
      return NextResponse.json(
        { error: "名前、メールアドレス、ロールは必須です。" },
        { status: 400 }
      );
    }

    if (role !== "admin" && role !== "agency") {
      return NextResponse.json(
        { error: "ロールの指定が不正です。" },
        { status: 400 }
      );
    }

    if (agencyId) {
      const { data: agency, error: agencyError } = await client
        .from("agencies")
        .select("id")
        .eq("id", agencyId)
        .maybeSingle();

      if (agencyError) {
        console.error("[/api/admin/users POST] agency lookup error", agencyError);
        return NextResponse.json(
          { error: "代理店情報の確認に失敗しました。" },
          { status: 500 }
        );
      }

      if (!agency) {
        return NextResponse.json(
          { error: "指定された代理店が存在しません。" },
          { status: 400 }
        );
      }
    }

    const password = generatePassword();
    const { data: authUser, error: authError } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authUser.user) {
      console.error("[/api/admin/users POST] auth creation error", authError);
      return NextResponse.json(
        { error: "ユーザーの作成に失敗しました。" },
        { status: 500 }
      );
    }

    const newProfile = {
      id: authUser.user.id,
      display_name: displayName,
      role,
      agency_id: agencyId,
      email,
    } as const;

    const { error: profileError } = await client.from("profiles").insert(newProfile);

    if (profileError) {
      console.error("[/api/admin/users POST] profile insert error", profileError);
      return NextResponse.json(
        { error: "プロフィールの作成に失敗しました。" },
        { status: 500 }
      );
    }

    const [{ data: agencyRows }, emails] = await Promise.all([
      client.from("agencies").select("id, name, code"),
      fetchEmailsByProfileIds([authUser.user.id]),
    ]);

    const user = mapProfilesToUsers(
      [
        {
          id: newProfile.id,
          display_name: newProfile.display_name,
          role: newProfile.role,
          agency_id: newProfile.agency_id,
          email: newProfile.email,
        } as Profile,
      ],
      (agencyRows ?? []) as Agency[],
      emails
    )[0];

    return NextResponse.json({
      user,
      initialPassword: password,
    });
  } catch (error) {
    console.error("[/api/admin/users POST] unexpected error", error);
    return NextResponse.json(
      { error: "ユーザーの作成に失敗しました。" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as PatchBody;

    if (!body.id) {
      return NextResponse.json(
        { error: "ユーザーIDが指定されていません。" },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id, display_name, role, agency_id, email")
      .eq("id", body.id)
      .maybeSingle();

    if (profileError) {
      console.error("[/api/admin/users PATCH] fetch profile error", profileError);
      return NextResponse.json(
        { error: "ユーザー情報の取得に失敗しました。" },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "指定されたユーザーが見つかりません。" },
        { status: 404 }
      );
    }

    let agencyIdToUse: string | null = body.agencyId ?? profile.agency_id ?? null;

    const newAgencyName = body.newAgencyName?.trim();
    if (newAgencyName) {
      const { data: existingAgency } = await client
        .from("agencies")
        .select("id, name, code")
        .eq("name", newAgencyName)
        .maybeSingle();

      if (existingAgency) {
        agencyIdToUse = existingAgency.id;
      } else {
        const insertPayload = {
          name: newAgencyName,
          code: slugify(newAgencyName),
        };

        const { data: createdAgency, error: insertAgencyError } = await client
          .from("agencies")
          .insert(insertPayload)
          .select("id, name, code")
          .maybeSingle();

        if (insertAgencyError) {
          console.error(
            "[/api/admin/users PATCH] create agency error",
            insertAgencyError
          );
          return NextResponse.json(
            { error: "代理店の作成に失敗しました。" },
            { status: 500 }
          );
        }

        agencyIdToUse = createdAgency?.id ?? agencyIdToUse;
      }
    } else if (agencyIdToUse) {
      const { data: existingAgency, error: agencyError } = await client
        .from("agencies")
        .select("id")
        .eq("id", agencyIdToUse)
        .maybeSingle();

      if (agencyError) {
        console.error(
          "[/api/admin/users PATCH] agency lookup error",
          agencyError
        );
        return NextResponse.json(
          { error: "代理店情報の確認に失敗しました。" },
          { status: 500 }
        );
      }

      if (!existingAgency) {
        return NextResponse.json(
          { error: "指定された代理店が存在しません。" },
          { status: 400 }
        );
      }
    }

    const { error: updateError } = await client
      .from("profiles")
      .update({ agency_id: agencyIdToUse })
      .eq("id", body.id);

    if (updateError) {
      console.error("[/api/admin/users PATCH] update profile error", updateError);
      return NextResponse.json(
        { error: "ユーザー情報の更新に失敗しました。" },
        { status: 500 }
      );
    }

    const { data: updatedProfile } = await client
      .from("profiles")
      .select("id, display_name, role, agency_id, email")
      .eq("id", body.id)
      .maybeSingle();

    const { data: agencies } = await client
      .from("agencies")
      .select("id, name, code");

    const emails = updatedProfile
      ? await fetchEmailsByProfileIds([updatedProfile.id])
      : {};

    const user = updatedProfile
      ? mapProfilesToUsers(
          [updatedProfile as Profile],
          (agencies ?? []) as Agency[],
          emails
        )[0]
      : null;

    return NextResponse.json({ user, agencies: agencies ?? [] });
  } catch (error) {
    console.error("[/api/admin/users PATCH] unexpected error", error);
    return NextResponse.json(
      { error: "ユーザー情報の更新に失敗しました。" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as PutBody;
    const { id, displayName, role, agencyId } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ユーザーIDが指定されていません。" },
        { status: 400 }
      );
    }

    const updates: Record<string, string | null> = {};

    if (typeof displayName === "string") {
      updates.display_name = displayName.trim();
    }

    if (role) {
      if (role !== "admin" && role !== "agency") {
        return NextResponse.json(
          { error: "ロールの指定が不正です。" },
          { status: 400 }
        );
      }
      updates.role = role;
    }

    if (agencyId !== undefined) {
      if (agencyId) {
        const { data: agency, error: agencyError } = await client
          .from("agencies")
          .select("id")
          .eq("id", agencyId)
          .maybeSingle();

        if (agencyError) {
          console.error("[/api/admin/users PUT] agency lookup error", agencyError);
          return NextResponse.json(
            { error: "代理店情報の確認に失敗しました。" },
            { status: 500 }
          );
        }

        if (!agency) {
          return NextResponse.json(
            { error: "指定された代理店が存在しません。" },
            { status: 400 }
          );
        }
        updates.agency_id = agencyId;
      } else {
        updates.agency_id = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "更新する項目が指定されていません。" },
        { status: 400 }
      );
    }

    const { error: updateError } = await client
      .from("profiles")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      console.error("[/api/admin/users PUT] update profile error", updateError);
      return NextResponse.json(
        { error: "ユーザー情報の更新に失敗しました。" },
        { status: 500 }
      );
    }

    const { data: profile } = await client
      .from("profiles")
      .select("id, display_name, role, agency_id, email")
      .eq("id", id)
      .maybeSingle();

    const { data: agencies } = await client
      .from("agencies")
      .select("id, name, code");

    const emails = profile ? await fetchEmailsByProfileIds([profile.id]) : {};

    const user = profile
      ? mapProfilesToUsers([profile as Profile], (agencies ?? []) as Agency[], emails)[0]
      : null;

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[/api/admin/users PUT] unexpected error", error);
    return NextResponse.json(
      { error: "ユーザー情報の更新に失敗しました。" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ユーザーIDが指定されていません。" },
        { status: 400 }
      );
    }

    const { error: deleteProfileError } = await client
      .from("profiles")
      .delete()
      .eq("id", id);

    if (deleteProfileError) {
      console.error("[/api/admin/users DELETE] profile delete error", deleteProfileError);
      return NextResponse.json(
        { error: "ユーザーの削除に失敗しました。" },
        { status: 500 }
      );
    }

    try {
      const { error: authDeleteError } = await client.auth.admin.deleteUser(id);
      if (authDeleteError) {
        console.error(
          "[/api/admin/users DELETE] auth delete error (non-blocking)",
          authDeleteError
        );
      }
    } catch (authError) {
      console.error("[/api/admin/users DELETE] auth delete unexpected", authError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/admin/users DELETE] unexpected error", error);
    return NextResponse.json(
      { error: "ユーザーの削除に失敗しました。" },
      { status: 500 }
    );
  }
}
