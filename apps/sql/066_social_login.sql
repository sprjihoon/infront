-- =============================================
-- 소셜 로그인(카카오/네이버/구글/애플) 대응
-- =============================================

-- 1. 소셜 로그인 제공자 구분 컬럼 추가
ALTER TABLE customers ADD COLUMN IF NOT EXISTS login_provider TEXT DEFAULT 'email';

-- 2. 이메일 NOT NULL 제약 해제
--    카카오(이메일 비제공 설정), 애플(이메일 숨기기) 대응
ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;

-- 3. handle_new_user 트리거: 소셜 로그인 시 email null 대응
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code TEXT;
  provider TEXT;
  user_email TEXT;
BEGIN
  code := generate_customer_code();
  provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  user_email := COALESCE(
    NEW.email,
    'oauth_' || NEW.id || '@noemail.infront.kr'
  );

  INSERT INTO public.customers (id, email, customer_code, personal_address, auth_user_id, login_provider)
  VALUES (
    NEW.id,
    user_email,
    code,
    '대구광역시 동구 동촌로 1 인프론트 (' || code || ')',
    NEW.id,
    provider
  )
  ON CONFLICT (id) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    email = CASE
      WHEN customers.email LIKE 'oauth_%' THEN EXCLUDED.email
      ELSE customers.email
    END;

  RETURN NEW;
END;
$$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_customers_login_provider ON customers(login_provider);
