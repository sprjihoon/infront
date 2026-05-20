-- ============================================================
-- 006_fix_addresses_rls.sql
-- customer_addresses RLS 정책 수정
-- 기존 정책의 auth_user_id 참조 오류 수정 (customers.id = auth.uid() 구조)
-- ============================================================

DROP POLICY IF EXISTS "addresses_self" ON customer_addresses;

CREATE POLICY "addresses_self" ON customer_addresses
  FOR ALL TO authenticated
  USING  (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
