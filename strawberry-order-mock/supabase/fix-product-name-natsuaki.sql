-- 商品名変更: 夏秋いちご（章姫）→ 夏秋いちご
-- fix-july-agency-orders.sql 実行後に続けて実行してください

UPDATE product_prices
SET product_name = '夏秋いちご'
WHERE product_name = '夏秋いちご（章姫）';

UPDATE orders
SET product_name = '夏秋いちご'
WHERE product_name = '夏秋いちご（章姫）';

-- 確認
SELECT DISTINCT product_name FROM product_prices ORDER BY product_name;
SELECT DISTINCT product_name FROM orders ORDER BY product_name;
