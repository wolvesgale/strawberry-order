// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Vercel の Environment Variables に自動で入っている値を使う
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
  );
}

// クライアント側で使う Supabase クライアント（DB 型付けは一旦なし）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
