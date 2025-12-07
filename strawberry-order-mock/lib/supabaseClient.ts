// lib/supabaseClient.ts

// ローカル開発・モック用の Supabase クライアントスタブ
// - auth.getUser: ダミーユーザーを返す
// - auth.signInWithPassword: 常に成功扱い
// - auth.signOut: 何もしない
// - from(...).select(...).eq(...).maybeSingle(): プロファイル用のダミーデータを返す

type SignInParams = {
  email: string;
  password: string;
};

type MockUser = {
  id: string;
  email: string;
};

const mockUser: MockUser = {
  id: "mock-user-id",
  email: "mock-user@example.com",
};

export const supabase = {
  auth: {
    async getUser() {
      return {
        data: {
          user: mockUser,
        },
        error: null,
      } as const;
    },

    async signInWithPassword({ email }: SignInParams) {
      console.log("[MOCK] signInWithPassword called", { email });

      return {
        data: {
          session: null,
          user: {
            id: mockUser.id,
            email,
          },
        },
        error: null,
      } as const;
    },

    async signOut() {
      console.log("[MOCK] signOut called");
      return {
        error: null,
      } as const;
    },
  },

  from(_table: string) {
    console.log("[MOCK] from called", { table: _table });

    return {
      select(_columns: string) {
        return {
          eq(_column: string, _value: any) {
            return {
              async maybeSingle() {
                // ログイン後に参照する profiles のダミーデータ
                return {
                  data: {
                    role: "admin",      // or "agency" に変えてもOK
                    agency_id: null,
                    agency_name: null,
                  },
                  error: null,
                } as const;
              },
            };
          },
        };
      },
    };
  },
};
