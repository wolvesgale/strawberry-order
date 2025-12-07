// lib/supabaseClient.ts

// このプロジェクトでは実際の Supabase SDK ではなく、
// 認証チェック用の超ライトなスタブを使います。
// 型エラーを避けるため auth.getUser / auth.signOut を用意しておく。

export const supabase = {
  auth: {
    async getUser() {
      // 常に「ログイン済みユーザー」がいる想定のモック
      return {
        data: {
          user: {
            id: "mock-user-id",
            email: "mock-user@example.com",
          },
        },
        error: null,
      } as const;
    },

    async signOut() {
      // 何もしないモック
      return { error: null } as const;
    },
  },
} as any;
