-- profiles テーブルに発注停止フラグを追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS order_disabled boolean DEFAULT false;

-- 伊藤、宮岡、金田の発注を停止する場合は以下を実行（display_name で指定）
-- UPDATE profiles SET order_disabled = true WHERE display_name IN ('伊藤', '宮岡', '金田');
