import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type BackfillResponse = {
  updatedProfilesCount: number;
  updatedOrdersUserIdCount: number;
  updatedOrdersAgencyIdCount: number;
  updatedOrdersUnitPriceCount: number;
  skippedCount: number;
};

function ensureSupabase() {
  if (!supabaseAdmin) {
    console.error(
      "[/api/admin/backfill] supabaseAdmin is null. Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."
    );
    return null;
  }
  return supabaseAdmin;
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

async function assertAdminUser(request: Request) {
  const client = ensureSupabase();
  if (!client) {
    return { ok: false, response: NextResponse.json({ error: "設定エラーです。" }, { status: 500 }) };
  }

  const token = getBearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "認証情報が不足しています。" }, { status: 401 }),
    };
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    console.error("[/api/admin/backfill] auth.getUser error", error);
    return {
      ok: false,
      response: NextResponse.json({ error: "認証に失敗しました。" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[/api/admin/backfill] profile lookup error", profileError);
    return {
      ok: false,
      response: NextResponse.json({ error: "権限確認に失敗しました。" }, { status: 500 }),
    };
  }

  if (profile?.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "管理者権限が必要です。" }, { status: 403 }),
    };
  }

  return { ok: true, userId: data.user.id };
}

async function listAllAuthUsers(client: NonNullable<ReturnType<typeof ensureSupabase>>) {
  const users: { id: string; email: string | null }[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const batch = data.users ?? [];
    batch.forEach((user) => {
      users.push({ id: user.id, email: user.email ?? null });
    });

    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function backfillProfilesEmail(
  client: NonNullable<ReturnType<typeof ensureSupabase>>,
  users: { id: string; email: string | null }[]
) {
  let updatedProfilesCount = 0;
  let skippedCount = 0;

  const chunkSize = 200;
  for (let i = 0; i < users.length; i += chunkSize) {
    const chunk = users.slice(i, i + chunkSize);
    const ids = chunk.map((user) => user.id);

    const { data: profiles, error: profilesError } = await client
      .from("profiles")
      .select("id, email")
      .in("id", ids);

    if (profilesError) {
      console.error("[/api/admin/backfill] profiles fetch error", profilesError);
      continue;
    }

    const emailById = new Map<string, string | null>();
    (profiles ?? []).forEach((profile: any) => {
      emailById.set(profile.id, profile.email ?? null);
    });

    const toUpsert = chunk
      .filter((user) => {
        if (!user.email) {
          skippedCount += 1;
          return false;
        }
        const existing = emailById.get(user.id);
        return existing == null;
      })
      .map((user) => ({ id: user.id, email: user.email }));

    if (toUpsert.length === 0) continue;

    const { error: upsertError } = await client.from("profiles").upsert(toUpsert);
    if (upsertError) {
      console.error("[/api/admin/backfill] profiles upsert error", upsertError);
      continue;
    }

    updatedProfilesCount += toUpsert.length;
  }

  return { updatedProfilesCount, skippedCount };
}

export async function POST(request: Request) {
  const client = ensureSupabase();
  if (!client) {
    return NextResponse.json(
      { error: "サーバー設定エラーです。管理者にお問い合わせください。" },
      { status: 500 }
    );
  }

  const adminCheck = await assertAdminUser(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const users = await listAllAuthUsers(client);
    const { updatedProfilesCount, skippedCount } = await backfillProfilesEmail(
      client,
      users
    );

    const { data: ordersBackfill, error: ordersBackfillError } = await client.rpc(
      "backfill_orders_actor_snapshot"
    );
    if (ordersBackfillError) {
      console.error("[/api/admin/backfill] orders backfill error", ordersBackfillError);
      return NextResponse.json(
        { error: "注文情報のバックフィルに失敗しました。" },
        { status: 500 }
      );
    }

    const { data: priceBackfill, error: priceBackfillError } = await client.rpc(
      "backfill_orders_price_history"
    );
    if (priceBackfillError) {
      console.error("[/api/admin/backfill] price backfill error", priceBackfillError);
      return NextResponse.json(
        { error: "単価のバックフィルに失敗しました。" },
        { status: 500 }
      );
    }

    const resultRow = Array.isArray(ordersBackfill) ? ordersBackfill[0] : ordersBackfill;
    const priceRow = Array.isArray(priceBackfill) ? priceBackfill[0] : priceBackfill;

    const response: BackfillResponse = {
      updatedProfilesCount,
      updatedOrdersUserIdCount: Number(resultRow?.updated_user_id_count ?? 0),
      updatedOrdersAgencyIdCount: Number(resultRow?.updated_agency_id_count ?? 0),
      updatedOrdersUnitPriceCount: Number(priceRow?.updated_unit_price_count ?? 0),
      skippedCount,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[/api/admin/backfill] unexpected error", error);
    return NextResponse.json(
      { error: error?.message ?? "バックフィルに失敗しました。" },
      { status: 500 }
    );
  }
}
