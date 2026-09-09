-- 過去の注文データ修正スクリプト
-- 税率を軽減税率8%に統一し、価格マスタに基づいて単価・合計金額を再計算する
-- Supabase の SQL エディタで実行してください

-- ステップ1: 価格マスタが存在する場合、単価を価格マスタから更新
-- (product_name + pieces_per_sheet + delivery_date で一致するレコードを使用)
UPDATE orders o
SET unit_price = (
  SELECT pp.unit_price
  FROM product_prices pp
  WHERE pp.pieces_per_sheet = o.pieces_per_sheet
    AND pp.product_name = o.product_name
    AND pp.effective_from <= COALESCE(o.delivery_date::date, CURRENT_DATE)
    AND (pp.effective_to IS NULL OR pp.effective_to >= COALESCE(o.delivery_date::date, CURRENT_DATE))
  ORDER BY pp.effective_from DESC
  LIMIT 1
)
WHERE o.pieces_per_sheet IS NOT NULL
  AND o.product_name IS NOT NULL
  AND o.status != 'canceled'
  AND EXISTS (
    SELECT 1 FROM product_prices pp
    WHERE pp.pieces_per_sheet = o.pieces_per_sheet
      AND pp.product_name = o.product_name
      AND pp.effective_from <= COALESCE(o.delivery_date::date, CURRENT_DATE)
      AND (pp.effective_to IS NULL OR pp.effective_to >= COALESCE(o.delivery_date::date, CURRENT_DATE))
  );

-- ステップ2: 価格マスタで更新できなかった注文は玉数ベースのフォールバック価格で更新
-- 夏秋いちご（章姫）2026年7月価格: 36玉=¥1,300, 30玉=¥1,550, 24玉=¥1,650, 20玉=¥1,700
UPDATE orders
SET unit_price = CASE pieces_per_sheet
  WHEN 36 THEN 1300
  WHEN 30 THEN 1550
  WHEN 24 THEN 1650
  WHEN 20 THEN 1700
  ELSE unit_price
END
WHERE pieces_per_sheet IN (36, 30, 24, 20)
  AND unit_price NOT IN (1300, 1550, 1650, 1700)
  AND status != 'canceled';

-- ステップ3: 税率を8%（農産物・軽減税率）に修正し、金額を再計算
UPDATE orders
SET
  tax_rate = 8,
  subtotal = unit_price * quantity,
  tax_amount = ROUND(unit_price::numeric * quantity * 8 / 100),
  total_amount = unit_price * quantity + ROUND(unit_price::numeric * quantity * 8 / 100)
WHERE unit_price IS NOT NULL
  AND quantity IS NOT NULL
  AND status != 'canceled';

-- 確認クエリ（実行後に結果を確認）
SELECT
  order_number,
  product_name,
  pieces_per_sheet,
  quantity,
  unit_price,
  tax_rate,
  subtotal,
  tax_amount,
  total_amount
FROM orders
WHERE status != 'canceled'
ORDER BY created_at DESC
LIMIT 20;
