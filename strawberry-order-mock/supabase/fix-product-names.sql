-- 過去の注文データ修正: product_name の内部ID表記を日本語表示名に統一
-- fix-historical-orders.sql を実行済みの場合はこちらも続けて実行してください

UPDATE orders
SET product_name = '夏秋いちご（章姫）'
WHERE product_name = 'akihime-summer';

UPDATE orders
SET product_name = '冬いちご（章姫）'
WHERE product_name = 'akihime-winter';

-- 確認
SELECT order_number, product_name, pieces_per_sheet, unit_price, tax_rate
FROM orders
WHERE status != 'canceled'
ORDER BY created_at DESC
LIMIT 20;
