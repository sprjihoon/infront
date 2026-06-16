-- ============================================================
-- 059_putaway_photo_customer_rls.sql
-- 고객이 본인 소포의 적치 확인 사진(PUTAWAY_PHOTO) 조회 가능
-- ============================================================

CREATE POLICY "parcel_media_putaway_self" ON parcel_media
  FOR SELECT
  USING (
    stage = 'PUTAWAY_PHOTO'
    AND parcel_id IN (SELECT id FROM parcels WHERE customer_id = auth.uid())
  );
