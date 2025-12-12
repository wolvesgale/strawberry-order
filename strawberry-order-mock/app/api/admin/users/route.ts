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
  agencies: Agency[]
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
        email: p.email ?? null,
        role: p.role,
        agencyId: p.agency_id,
        agencyName: agency?.name ?? null,
      } satisfies AdminUserListItem;
    });
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

    const users = mapProfilesToUsers(profiles, agencies);

    return NextResponse.json({ agencies, users });
  } catch (error) {
    console.error("[/api/admin/users GET] unexpected error", error);
    return NextResponse.json(
      { error: "ユーザー情報の取得に失敗しました。" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "新規ユーザーの作成は管理者が手動で行います。この画面からの登録は無効化されています。",
    },
    { status: 405 }
  );
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

    const user = updatedProfile
      ? mapProfilesToUsers([updatedProfile as Profile], (agencies ?? []) as Agency[])[0]
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
