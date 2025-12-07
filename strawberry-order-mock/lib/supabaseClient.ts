// Mock supabase client used for local development/builds.
// Replace with a real Supabase client when backend credentials are available.
export const supabase = {
  auth: {
    async getUser() {
      return {
        data: {
          user: { email: 'mock-user@example.com' },
        },
        error: null,
      } as const;
    },
  },
};
