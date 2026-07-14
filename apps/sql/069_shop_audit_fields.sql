-- ============================================================
-- 069_shop_audit_fields.sql
-- KG이니시스 해외카드/글로벌결제 심사용 필드
-- ============================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'domestic'
  CHECK (customer_type IN ('domestic', 'foreigner'));

ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'domestic'
  CHECK (customer_type IN ('domestic', 'foreigner'));

CREATE INDEX IF NOT EXISTS idx_shop_orders_user_id ON shop_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_customer_type ON customers(customer_type);

COMMENT ON COLUMN customers.customer_type IS '고객 구분: domestic(내국인) / foreigner(외국인)';
COMMENT ON COLUMN shop_orders.user_id IS '회원 주문 시 auth.users.id';
COMMENT ON COLUMN shop_orders.customer_type IS '주문 시점 고객 구분';

-- handle_new_user: customer_type from signup metadata
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
  ctype TEXT;
BEGIN
  code := generate_customer_code();
  provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  user_email := COALESCE(
    NEW.email,
    'oauth_' || NEW.id || '@noemail.infront.kr'
  );
  ctype := COALESCE(NEW.raw_user_meta_data->>'customer_type', 'domestic');
  IF ctype NOT IN ('domestic', 'foreigner') THEN
    ctype := 'domestic';
  END IF;

  INSERT INTO public.customers (id, email, customer_code, personal_address, auth_user_id, login_provider, customer_type, name, phone)
  VALUES (
    NEW.id,
    user_email,
    code,
    '대구광역시 동구 동촌로 1 인프론트 (' || code || ')',
    NEW.id,
    provider,
    ctype,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    customer_type = COALESCE(customers.customer_type, EXCLUDED.customer_type),
    name = COALESCE(EXCLUDED.name, customers.name),
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    email = CASE
      WHEN customers.email LIKE 'oauth_%' THEN EXCLUDED.email
      ELSE customers.email
    END;

  RETURN NEW;
END;
$$;

COMMENT ON TABLE shop_orders IS '샵 일회성 서비스 주문 (회원 결제)';
