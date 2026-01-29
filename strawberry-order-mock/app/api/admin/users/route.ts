import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type AgencyRow = {
  id: string;
  name: string;
  code: string | null;
};

type Agency = AgencyRow;

type Profile = {
  id: string;
  display_name: string | null;
  role: "admin" | "agency" | null;
  agency_id: string | null;
  email?: string | null;
};

export type AdminUserListItem = {
  id: string;
  name: string;
  email?: string | null;
  role: "admin" | "agency";
  agencyId: string | null;
  agencyName: string | null;
};

type PostBody = {
  displayName?: string;
  name?: string;
  email?: string;
  role?: "admin" | "agency";
  agencyId?: string | null;
  newAgencyName?: string | null;
};

type PutBody = {
  id?: string;
  displayName?: string;
  name?: string;
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
  emailsById: Record<string, string | null>
): AdminUserListItem[] {
  return profiles
    .filter((p): p is Profile & { role: "admin" | "agency" } => {
      return p.role === "admin" || p.role === "agency";
    })
    .map((p) => {
      const agency = agencies.find((a) => a.id === p.agency_id);
      return {
        id: p.id,
        name: p.display_name ?? "(名称未設定)",
        email: emailsById[p.id] ?? p.email ?? null,
        role: p.role,
        agencyId: p.agency_id,
        agencyName: agency?.name ?? null,
      };
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
        console.error("[/api/admin/users] auth fetch error", { id, error });
        emails[id] = null;
        continue;
      }
      emails[id] = data.user?.email ?? null;
    } catch (e) {
      console.error("[/api/admin/users] auth fetch unexpected", { id, e });
      emails[id] = null;
    }
  }

  return emails;
}

function generatePassword(length = 16) {
  return crypto.randomBytes(length).toString("base64url");
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
    const [
      { data: agencyRows, error: agencyError },
      { data: profileRows, error: profilesError },
    ] = await Promise.all([
      client.from("agencies").select("id, name, code"),
      client.from("profiles").select("id, display_name, role, agency_id, email"),
    ]);

    if (agencyError) {
      console.error("[/api/admin/users GET] agencies error", agencyError);
      return NextResponse.json(
        { error: "代理店情報の取得に失敗しました。" },
        { status: 500 }
      );
    }

    if (profilesError) {
      console.error("[/api/admin/users GET] profiles error", profilesError);
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

// POST: 新規ユーザー作成（auth + profiles）
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
    const displayName = (body.name ?? body.displayName)?.trim();
    const email = body.email?.trim();
    const role = body.role;
    const agencyId = body.agencyId ?? null;
    const newAgencyName = body.newAgencyName?.trim() ?? null;

    if (!displayName || !email || !role) {
      return NextResponse.json(
        { error: "名前、メールアドレス、ロールは必須です。" },
        { status: 400 }
      );
    }

    if (role !== "admin" && role !== "agency") {
      return NextResponse.json({ error: "ロールの指定が不正です。" }, { status: 400 });
    }

    let agencyIdToUse: string | null = agencyId;

    // agencyId が指定されているなら存在確認
    if (agencyIdToUse) {
      const { data: existing, error } = await client
        .from("agencies")
        .select("id")
        .eq("id", agencyIdToUse)
        .maybeSingle();

      if (error) {
        console.error("[/api/admin/users POST] agency lookup error", error);
        return NextResponse.json({ error: "代理店情報の確認に失敗しました。" }, { status: 500 });
      }
      if (!existing) {
        return NextResponse.json({ error: "指定された代理店が存在しません。" }, { status: 400 });
      }
    }

    // agencyロールなら、agencyId または newAgencyName が必須
    if (role === "agency" && !agencyIdToUse) {
      if (!newAgencyName) {
        return NextResponse.json(
          { error: "代理店ユーザーの場合、所属代理店か新しい代理店名を入力してください。" },
          { status: 400 }
        );
      }

      const { data: existingAgency, error: lookupError } = await client
        .from("agencies")
        .select("id, name, code")
        .eq("name", newAgencyName)
        .maybeSingle();

      if (lookupError) {
        console.error("[/api/admin/users POST] agency lookup error", lookupError);
        return NextResponse.json({ error: "代理店情報の確認に失敗しました。" }, { status: 500 });
      }

      if (existingAgency) {
        agencyIdToUse = existingAgency.id;
      } else {
        const { data: createdAgency, error: insertError } = await client
          .from("agencies")
          .insert({ name: newAgencyName, code: slugify(newAgencyName) })
          .select("id, name, code")
          .maybeSingle();

        if (insertError) {
          console.error("[/api/admin/users POST] agency insert error", insertError);
          return NextResponse.json({ error: "代理店の作成に失敗しました。" }, { status: 500 });
        }

        agencyIdToUse = createdAgency?.id ?? null;
      }
    }

    const password = generatePassword();
    const { data: authCreated, error: authError } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authCreated.user) {
      console.error("[/api/admin/users POST] auth creation error", authError);
      return NextResponse.json({ error: "ユーザーの作成に失敗しました。" }, { status: 500 });
    }

    const profilePayload = {
      id: authCreated.user.id,
      display_name: displayName,
      role,
      agency_id: agencyIdToUse,
      email,
    } as const;

    const { error: profileInsertError } = await client.from("profiles").insert(profilePayload);
    if (profileInsertError) {
      console.error("[/api/admin/users POST] profile insert error", profileInsertError);
      return NextResponse.json({ error: "プロフィールの作成に失敗しました。" }, { status: 500 });
    }

    const [{ data: agencyRows }, emails] = await Promise.all([
      client.from("agencies").select("id, name, code"),
      fetchEmailsByProfileIds([authCreated.user.id]),
    ]);

    const createdUser = mapProfilesToUsers(
      [
        {
          id: profilePayload.id,
          display_name: profilePayload.display_name,
          role: profilePayload.role,
          agency_id: profilePayload.agency_id,
          email: profilePayload.email,
        } as Profile,
      ],
      (agencyRows ?? []) as Agency[],
      emails
    )[0];

    return NextResponse.json({ user: createdUser, initialPassword: password });
  } catch (error) {
    console.error("[/api/admin/users POST] unexpected error", error);
    return NextResponse.json({ error: "ユーザーの作成に失敗しました。" }, { status: 500 });
  }
}

// PUT: ユーザー更新（display_name / role / agency_id）
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
    const id = body.id?.trim();
    const displayName = (body.name ?? body.displayName)?.trim();
    const role = body.role;
    const agencyId = body.agencyId;

    if (!id) {
      return NextResponse.json({ error: "ユーザーIDが指定されていません。" }, { status: 400 });
    }

    const updates: Record<string, any> = {};

    if (typeof displayName === "string" && displayName.length > 0) {
      updates.display_name = displayName;
    }

    if (role !== undefined) {
      if (role !== "admin" && role !== "agency") {
        return NextResponse.json({ error: "ロールの指定が不正です。" }, { status: 400 });
      }
      updates.role = role;
    }

    if (agencyId !== undefined) {
      if (agencyId) {
        const { data: agency, error } = await client
          .from("agencies")
          .select("id")
          .eq("id", agencyId)
          .maybeSingle();

        if (error) {
          console.error("[/api/admin/users PUT] agency lookup error", error);
          return NextResponse.json({ error: "代理店情報の確認に失敗しました。" }, { status: 500 });
        }
        if (!agency) {
          return NextResponse.json({ error: "指定された代理店が存在しません。" }, { status: 400 });
        }
        updates.agency_id = agencyId;
      } else {
        updates.agency_id = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "更新する項目が指定されていません。" }, { status: 400 });
    }

    const { error: updateError } = await client.from("profiles").update(updates).eq("id", id);
    if (updateError) {
      console.error("[/api/admin/users PUT] update profile error", updateError);
      return NextResponse.json({ error: "ユーザー情報の更新に失敗しました。" }, { status: 500 });
    }

    const [{ data: profile }, { data: agencies }] = await Promise.all([
      client.from("profiles").select("id, display_name, role, agency_id, email").eq("id", id).maybeSingle(),
      client.from("agencies").select("id, name, code"),
    ]);

    const emails = profile ? await fetchEmailsByProfileIds([profile.id]) : {};
    const user = profile
      ? mapProfilesToUsers([profile as Profile], (agencies ?? []) as Agency[], emails)[0]
      : null;

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[/api/admin/users PUT] unexpected error", error);
    return NextResponse.json({ error: "ユーザー情報の更新に失敗しました。" }, { status: 500 });
  }
}

// PATCH: 所属代理店のみ更新（agencyId / newAgencyName）
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
    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "ユーザーIDが指定されていません。" }, { status: 400 });
    }

    const { data: currentProfile, error: currentError } = await client
      .from("profiles")
      .select("id, display_name, role, agency_id, email")
      .eq("id", id)
      .maybeSingle();

    if (currentError) {
      console.error("[/api/admin/users PATCH] fetch profile error", currentError);
      return NextResponse.json({ error: "ユーザー情報の取得に失敗しました。" }, { status: 500 });
    }
    if (!currentProfile) {
      return NextResponse.json({ error: "指定されたユーザーが見つかりません。" }, { status: 404 });
    }

    let agencyIdToUse: string | null =
      body.agencyId !== undefined ? body.agencyId : (currentProfile.agency_id ?? null);

    const newAgencyName = body.newAgencyName?.trim();
    if (newAgencyName) {
      const { data: existingAgency, error: lookupError } = await client
        .from("agencies")
        .select("id, name, code")
        .eq("name", newAgencyName)
        .maybeSingle();

      if (lookupError) {
        console.error("[/api/admin/users PATCH] agency lookup error", lookupError);
        return NextResponse.json({ error: "代理店情報の確認に失敗しました。" }, { status: 500 });
      }

      if (existingAgency) {
        agencyIdToUse = existingAgency.id;
      } else {
        const { data: createdAgency, error: insertError } = await client
          .from("agencies")
          .insert({ name: newAgencyName, code: slugify(newAgencyName) })
          .select("id, name, code")
          .maybeSingle();

        if (insertError) {
          console.error("[/api/admin/users PATCH] agency insert error", insertError);
          return NextResponse.json({ error: "代理店の作成に失敗しました。" }, { status: 500 });
        }
        agencyIdToUse = createdAgency?.id ?? agencyIdToUse;
      }
    } else if (agencyIdToUse) {
      // agencyIdToUse が指定されている場合は存在確認
      const { data: existing, error: agencyError } = await client
        .from("agencies")
        .select("id")
        .eq("id", agencyIdToUse)
        .maybeSingle();

      if (agencyError) {
        console.error("[/api/admin/users PATCH] agency lookup error", agencyError);
        return NextResponse.json({ error: "代理店情報の確認に失敗しました。" }, { status: 500 });
      }
      if (!existing) {
        return NextResponse.json({ error: "指定された代理店が存在しません。" }, { status: 400 });
      }
    }

    const { error: updateError } = await client
      .from("profiles")
      .update({ agency_id: agencyIdToUse })
      .eq("id", id);

    if (updateError) {
      console.error("[/api/admin/users PATCH] update profile error", updateError);
      return NextResponse.json({ error: "ユーザー情報の更新に失敗しました。" }, { status: 500 });
    }

    const [{ data: updatedProfile }, { data: agencies }] = await Promise.all([
      client.from("profiles").select("id, display_name, role, agency_id, email").eq("id", id).maybeSingle(),
      client.from("agencies").select("id, name, code"),
    ]);

    const emails = updatedProfile ? await fetchEmailsByProfileIds([updatedProfile.id]) : {};
    const user = updatedProfile
      ? mapProfilesToUsers([updatedProfile as Profile], (agencies ?? []) as Agency[], emails)[0]
      : null;

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[/api/admin/users PATCH] unexpected error", error);
    return NextResponse.json({ error: "ユーザー情報の更新に失敗しました。" }, { status: 500 });
  }
}

// DELETE: ユーザー削除（profiles → auth）
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
      return NextResponse.json({ error: "ユーザーIDが指定されていません。" }, { status: 400 });
    }

    const { error: deleteProfileError } = await client.from("profiles").delete().eq("id", id);
    if (deleteProfileError) {
      console.error("[/api/admin/users DELETE] profile delete error", deleteProfileError);
      return NextResponse.json({ error: "ユーザーの削除に失敗しました。" }, { status: 500 });
    }

    // auth 側削除は失敗しても致命ではない（ログだけ）
    try {
      const { error: authDeleteError } = await client.auth.admin.deleteUser(id);
      if (authDeleteError) {
        console.error("[/api/admin/users DELETE] auth delete error (non-blocking)", authDeleteError);
      }
    } catch (authError) {
      console.error("[/api/admin/users DELETE] auth delete unexpected", authError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/admin/users DELETE] unexpected error", error);
    return NextResponse.json({ error: "ユーザーの削除に失敗しました。" }, { status: 500 });
  }
}
