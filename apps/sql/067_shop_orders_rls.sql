-- ============================================================
-- 067_shop_orders_rls.sql
-- shop_orders 테이블 Row-Level Security 활성화
--
-- 모든 접근은 service_role 키를 사용하는 서버 API를 통해서만
-- 이루어지므로 공개 정책 없이 RLS만 활성화합니다.
-- service_role은 RLS를 자동으로 우회하므로 기존 동작에
-- 영향을 주지 않습니다.
-- ============================================================

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

-- 혹시 남아있는 기존 정책을 제거하고 새로 정의
DROP POLICY IF EXISTS "shop_orders_public_read"  ON public.shop_orders;
DROP POLICY IF EXISTS "shop_orders_public_write" ON public.shop_orders;
DROP POLICY IF EXISTS "shop_orders_anon_read"    ON public.shop_orders;
DROP POLICY IF EXISTS "shop_orders_anon_insert"  ON public.shop_orders;

-- 공개(anon) 및 인증된(authenticated) 역할에는 접근 권한 없음.
-- service_role(서버 API)은 RLS를 우회하여 모든 작업 수행 가능.
