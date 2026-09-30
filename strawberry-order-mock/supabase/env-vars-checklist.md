# Vercel 環境変数チェックリスト

Vercel の Settings → Environment Variables に以下を設定してください。

## ① Supabase（新しいプロジェクト作成後に取得）

| 変数名 | 取得場所 | 説明 |
|--------|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | 例: `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon public | 公開キー |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role | 管理用（非公開） |

## ② メール送信（Resend に切り替え）

AWS SES の代わりに [Resend](https://resend.com) を使います（IAMキー不要）。

| 変数名 | 値 | 説明 |
|--------|-----|------|
| `RESEND_API_KEY` | Resend ダッシュボードで発行 | `re_xxxxxxxx` |
| `RESEND_FROM_EMAIL` | `saiya0318@saiya.info` | 送信元（要Resendでドメイン認証） |
| `ORDER_TO_EMAIL` | ★クライアント（加藤さん）に確認 | 発注メール受信先 |
| `ORDER_CC_EMAIL` | 必要な場合のみ | CC宛先（任意） |
| `ORDER_MAIL_MODE` | `resend` | `mock`=送信スキップ / `resend`=実送信 |

## ③ 確認事項

- [ ] Supabase 新プロジェクト作成済み
- [ ] `setup-full.sql` を Supabase SQL Editor で実行済み
- [ ] 商品価格マスタ（`seed-product-prices-2026-07.sql`）を実行済み
- [ ] Auth でユーザー再作成済み（admin + 各代理店ユーザー）
- [ ] 伊藤・宮岡・金田の `order_disabled = true` を設定済み
- [ ] Resend アカウント作成 & `saiya0318@saiya.info` のドメイン認証済み
- [ ] Vercel に上記環境変数をすべて設定済み
- [ ] `claude/user-password-management-KDdBk` ブランチでデプロイ済み
- [ ] ORDER_TO_EMAIL をクライアントから確認済み

## Resend セットアップ手順

1. https://resend.com でアカウント作成
2. Domains → Add Domain → `saiya.info` を追加
3. 表示される DNS レコード（TXT/MX/DKIM）をドメイン管理画面に追加
4. 認証完了後、API Keys → Create API Key
5. 発行されたキーを `RESEND_API_KEY` に設定

## 注文履歴の復元について

クライアント（加藤さん）へ以下を依頼：
「`saiya0318@saiya.info` に届いた件名【いちご発注】のメールを
 確認して、注文内容（日付・代理店・商品・数量）を教えてください」
