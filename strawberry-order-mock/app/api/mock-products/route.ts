// app/api/mock-products/route.ts
import { NextResponse } from 'next/server';

export type Season = 'summer' | 'summer_autumn' | 'winter';

export type MockProduct = {
  id: string;
  name: string;
  code: string;
  season: Season;
  unitPrice: number; // 税抜
  taxRate: number;   // 0.08 / 0.10
};

// 簡易マスタ（後でSupabaseに移行予定）
export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: 'p1',
    name: '夏いちご',
    code: 'summer',
    season: 'summer',
    unitPrice: 800,
    taxRate: 0.08,
  },
  {
    id: 'p2',
    name: '夏秋いちご',
    code: 'summer-autumn',
    season: 'summer_autumn',
    unitPrice: 900,
    taxRate: 0.08,
  },
  {
    id: 'p3',
    name: '冬いちご',
    code: 'winter',
    season: 'winter',
    unitPrice: 1000,
    taxRate: 0.08,
  },
  {
    id: 'p4',
    name: 'プレミアムいちご詰め合わせ',
    code: 'premium-mix',
    season: 'summer_autumn',
    unitPrice: 1500,
    taxRate: 0.08,
  },
];

export function GET() {
  return NextResponse.json({ products: MOCK_PRODUCTS });
}
