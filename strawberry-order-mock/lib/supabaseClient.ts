// strawberry-order-mock/lib/supabaseClient.ts
// ブラウザ側から使う Supabase クライアント（本番運用前提）

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 本番運用前提なので、環境変数が無ければ即エラーにする
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。Vercel の環境変数を確認してください。"
  );
}

// v2 クライアント（型は汎用的にしておく）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
