import { NextResponse } from 'next/server';

type Agency = {
  id: string;
  name: string;
  code: string;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agency';
  agencyId?: string | null;
  createdAt: string;
};

const AGENCIES: Agency[] = [
  { id: 'a1', name: '前田', code: 'maeda' },
  { id: 'a2', name: '東海', code: 'tokai' },
];

const USERS: AdminUser[] = [
  {
    id: 'u-admin',
    name: '管理者ユーザー',
    email: 'admin@example.com',
    role: 'admin',
    agencyId: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u-agency',
    name: '代理店ユーザー',
    email: 'agency@example.com',
    role: 'agency',
    agencyId: 'a1',
    createdAt: new Date().toISOString(),
  },
];

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 16) || 'agency';
}

function findOrCreateAgency(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const existing = AGENCIES.find((a) => a.name === trimmed);
  if (existing) return existing;

  const created: Agency = {
    id: crypto.randomUUID(),
    name: trimmed,
    code: slugify(trimmed),
  };
  AGENCIES.push(created);
  return created;
}

export async function GET() {
  return NextResponse.json({ agencies: AGENCIES, users: USERS });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<AdminUser> & {
      agencyId?: string | null;
      newAgencyName?: string | null;
    };

    const name = body.name?.trim();
    const email = body.email?.trim();
    const role = body.role;

    if (!name || !email || (role !== 'admin' && role !== 'agency')) {
      return NextResponse.json(
        { error: '名前、メール、ロールは必須です。' },
        { status: 400 },
      );
    }

    let agencyIdToUse: string | null | undefined = body.agencyId ?? null;

    const createdAgency = findOrCreateAgency(body.newAgencyName);
    if (createdAgency) {
      agencyIdToUse = createdAgency.id;
    } else if (agencyIdToUse) {
      const exists = AGENCIES.some((a) => a.id === agencyIdToUse);
      if (!exists) {
        return NextResponse.json(
          { error: '指定された代理店が存在しません。' },
          { status: 400 },
        );
      }
    }

    const user: AdminUser = {
      id: crypto.randomUUID(),
      name,
      email,
      role,
      agencyId: agencyIdToUse ?? null,
      createdAt: new Date().toISOString(),
    };

    USERS.push(user);

    return NextResponse.json({ user, agencies: AGENCIES }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'ユーザー作成に失敗しました。' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<AdminUser> & {
      id?: string;
      newAgencyName?: string | null;
    };

    if (!body.id) {
      return NextResponse.json(
        { error: 'ユーザーIDが指定されていません。' },
        { status: 400 },
      );
    }

    const target = USERS.find((u) => u.id === body.id);
    if (!target) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません。' },
        { status: 404 },
      );
    }

    const createdAgency = findOrCreateAgency(body.newAgencyName);
    let agencyIdToUse = body.agencyId ?? target.agencyId ?? null;

    if (createdAgency) {
      agencyIdToUse = createdAgency.id;
    } else if (agencyIdToUse) {
      const exists = AGENCIES.some((a) => a.id === agencyIdToUse);
      if (!exists) {
        return NextResponse.json(
          { error: '指定された代理店が存在しません。' },
          { status: 400 },
        );
      }
    }

    if (body.name?.trim()) target.name = body.name.trim();
    if (body.email?.trim()) target.email = body.email.trim();
    if (body.role === 'admin' || body.role === 'agency') target.role = body.role;

    target.agencyId = agencyIdToUse;

    return NextResponse.json({ user: target, agencies: AGENCIES });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'ユーザー更新に失敗しました。' },
      { status: 500 },
    );
  }
}
