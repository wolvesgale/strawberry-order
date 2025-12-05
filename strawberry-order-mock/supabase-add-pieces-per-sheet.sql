-- orders テーブルに玉数カラムを追加
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS pieces_per_sheet integer NOT NULL DEFAULT 36;
