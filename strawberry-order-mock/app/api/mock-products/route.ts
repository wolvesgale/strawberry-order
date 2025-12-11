// strawberry-order-mock/app/api/mock-products/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export type Season = "summer" | "autumn" | "winter";

export type MockProduct = {
  id: string;
  name: string;
  season: Season;
  unitPrice: number;
  taxRate: number; // パーセント表記（10 = 10%）
};

// ★ 商品マスタ：ここを書き換えるとデフォルト単価が変わる
export const PRODUCTS: MockProduct[] = [
  {
    id: "akihime-summer",
    name: "夏いちご（章姫）",
    season: "summer",
    unitPrice: 5000,
    taxRate: 10,
  },
  {
    id: "akihime-autumn",
    name: "秋いちご（章姫）",
    season: "autumn",
    unitPrice: 5200,
    taxRate: 10,
  },
  {
    id: "akihime-winter",
    name: "冬いちご（章姫）",
    season: "winter",
    unitPrice: 5500,
    taxRate: 10,
  },
  {
    id: "benihoppe-winter",
    name: "冬いちご（紅ほっぺ）",
    season: "winter",
    unitPrice: 5800,
    taxRate: 10,
  },
];

export async function GET() {
  return NextResponse.json({ products: PRODUCTS });
}
