-- 7月7日以降の NULL agency_id 注文復元 + 代理店名変更スクリプト
-- Supabase の SQL エディタで実行してください

-- ステップ1: 代理店名変更（まず agencies テーブルを更新）
-- 仮いちご → いちご丸ごといちご大福　小山
UPDATE agencies
SET name = 'いちご丸ごといちご大福　小山'
WHERE name = '仮いちご';

-- ステップ2: 既存注文の agency_name スナップショットも更新
UPDATE orders
SET agency_name = 'いちご丸ごといちご大福　小山'
WHERE agency_name = '仮いちご';

-- ステップ3: 7/7以降の NULL agency_id 注文を profiles → agencies 経由で復元
-- （ステップ1の名称変更後に実行するので新名称が自動的に入る）
UPDATE orders o
SET
  agency_id = p.agency_id,
  agency_name = a.name
FROM profiles p
JOIN agencies a ON a.id = p.agency_id
WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(o.created_by_email))
  AND o.agency_id IS NULL
  AND o.status != 'canceled';

-- ステップ4: profiles.email を小文字に正規化（将来の照合ずれ防止）
UPDATE profiles
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL
  AND email != LOWER(TRIM(email));

-- 確認クエリ
SELECT
  order_number,
  created_at::date AS order_date,
  created_by_email,
  agency_id,
  agency_name
FROM orders
WHERE created_at >= '2026-07-07'
  AND status != 'canceled'
ORDER BY created_at DESC
LIMIT 40;
