-- handle_new_user: customer_code 중복 호출 방지 + search_path 고정
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code TEXT;
BEGIN
  code := generate_customer_code();

  INSERT INTO public.customers (id, email, customer_code, personal_address, auth_user_id)
  VALUES (
    NEW.id,
    NEW.email,
    code,
    '대구광역시 동구 동촌로 1 인프론트 (' || code || ')',
    NEW.id
  )
  ON CONFLICT (id) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    email = EXCLUDED.email;

  RETURN NEW;
END;
$$;
