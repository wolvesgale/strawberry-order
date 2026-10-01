-- ================================================
-- Strawberry Order ユーザー一括作成SQL
-- ※ 宮岡（苺ぽんぽこ堂）は別途追加
-- ================================================


DO $$
DECLARE
  v_uid uuid;
BEGIN
  -- いちごの香り (furutako08@icloud.com)
  SELECT id INTO v_uid FROM auth.users WHERE email = 'furutako08@icloud.com' LIMIT 1;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated',
      'furutako08@icloud.com', crypt('SLTAuriKaPgE', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '', '', '', ''
    );
  END IF;
  INSERT INTO public.profiles (id, email, display_name, role, agency_id)
  VALUES (
    v_uid, 'furutako08@icloud.com', 'いちごの香り', 'agency',
    (SELECT id FROM public.agencies WHERE name = 'いちごの香り' LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    agency_id = EXCLUDED.agency_id;

  -- いちご丸ごといちご大福　小山 (ia.dor9192@gmail.com)
  SELECT id INTO v_uid FROM auth.users WHERE email = 'ia.dor9192@gmail.com' LIMIT 1;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated',
      'ia.dor9192@gmail.com', crypt('N2iYLWHXQteN', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '', '', '', ''
    );
  END IF;
  INSERT INTO public.profiles (id, email, display_name, role, agency_id)
  VALUES (
    v_uid, 'ia.dor9192@gmail.com', 'いちご丸ごといちご大福　小山', 'agency',
    (SELECT id FROM public.agencies WHERE name = 'いちご丸ごといちご大福　小山' LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    agency_id = EXCLUDED.agency_id;

  -- いちご丸ごといちご大福　小山 (sumiyasaki47@gmail.com)
  SELECT id INTO v_uid FROM auth.users WHERE email = 'sumiyasaki47@gmail.com' LIMIT 1;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated',
      'sumiyasaki47@gmail.com', crypt('68gZSJoQM4hz', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '', '', '', ''
    );
  END IF;
  INSERT INTO public.profiles (id, email, display_name, role, agency_id)
  VALUES (
    v_uid, 'sumiyasaki47@gmail.com', 'いちご丸ごといちご大福　小山', 'agency',
    (SELECT id FROM public.agencies WHERE name = 'いちご丸ごといちご大福　小山' LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    agency_id = EXCLUDED.agency_id;

  -- 和心 (aikawa0315@gmail.com)
  SELECT id INTO v_uid FROM auth.users WHERE email = 'aikawa0315@gmail.com' LIMIT 1;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated',
      'aikawa0315@gmail.com', crypt('SkyTNv8BPwb1', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '', '', '', ''
    );
  END IF;
  INSERT INTO public.profiles (id, email, display_name, role, agency_id)
  VALUES (
    v_uid, 'aikawa0315@gmail.com', '和心', 'agency',
    (SELECT id FROM public.agencies WHERE name = '和心' LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    agency_id = EXCLUDED.agency_id;

  -- こうちゃん団子 (datensin564219@yahoo.co.jp)
  SELECT id INTO v_uid FROM auth.users WHERE email = 'datensin564219@yahoo.co.jp' LIMIT 1;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated',
      'datensin564219@yahoo.co.jp', crypt('dw4fHzDiwwI2', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '', '', '', ''
    );
  END IF;
  INSERT INTO public.profiles (id, email, display_name, role, agency_id)
  VALUES (
    v_uid, 'datensin564219@yahoo.co.jp', 'こうちゃん団子', 'agency',
    (SELECT id FROM public.agencies WHERE name = 'こうちゃん団子' LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    agency_id = EXCLUDED.agency_id;

  -- 和心 (kanedayuto@yahoo.co.jp)
  SELECT id INTO v_uid FROM auth.users WHERE email = 'kanedayuto@yahoo.co.jp' LIMIT 1;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated',
      'kanedayuto@yahoo.co.jp', crypt('HSq7vbsBaz4E', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '', '', '', ''
    );
  END IF;
  INSERT INTO public.profiles (id, email, display_name, role, agency_id)
  VALUES (
    v_uid, 'kanedayuto@yahoo.co.jp', '和心', 'agency',
    (SELECT id FROM public.agencies WHERE name = '和心' LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    agency_id = EXCLUDED.agency_id;

  -- 苺のより道 (togachef0707@gmail.com)
  SELECT id INTO v_uid FROM auth.users WHERE email = 'togachef0707@gmail.com' LIMIT 1;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated',
      'togachef0707@gmail.com', crypt('ev5HlUqcbeYk', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '', '', '', ''
    );
  END IF;
  INSERT INTO public.profiles (id, email, display_name, role, agency_id)
  VALUES (
    v_uid, 'togachef0707@gmail.com', '苺のより道', 'agency',
    (SELECT id FROM public.agencies WHERE name = '苺のより道' LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    agency_id = EXCLUDED.agency_id;

  -- いちご丸ごといちご大福　小山 (kymknsk@gmail.com)
  SELECT id INTO v_uid FROM auth.users WHERE email = 'kymknsk@gmail.com' LIMIT 1;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated',
      'kymknsk@gmail.com', crypt('bTU9mPIIKPeo', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '', '', '', ''
    );
  END IF;
  INSERT INTO public.profiles (id, email, display_name, role, agency_id)
  VALUES (
    v_uid, 'kymknsk@gmail.com', 'いちご丸ごといちご大福　小山', 'agency',
    (SELECT id FROM public.agencies WHERE name = 'いちご丸ごといちご大福　小山' LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    agency_id = EXCLUDED.agency_id;

END $$;