This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Operational notes

### Email delivery settings

Set the sender address explicitly via `ORDER_FROM_EMAIL`.
The recipient address is configured with `ORDER_TO_EMAIL` and `ORDER_MAIL_MODE=ses`
when AWS SES should be used.

### Email send tracking migration

Apply the SQL migration in `supabase/migrations/` to add `email_sent_at` and
`email_message_id`, and to normalize legacy `shipped` statuses to `sent`.

### Agency backfill (existing orders)

If existing orders are missing agency information, run the SQL script below once to
populate `orders.agency_id` / `orders.agency_name` from `profiles.email`.

```sql
-- supabase/backfill_agency.sql
```

### Agency profile columns

If your Supabase project does not yet have `profiles.email`, `profiles.agency_id`,
or `profiles.agency_name` (and the `agencies` table), apply the latest migration in
`supabase/migrations/` to add them as nullable fields for backward compatibility.
