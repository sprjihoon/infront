-- 입고 경로: PICKUP(앱 수거신청) / DIRECT(고객 물품등록·타택배)
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS inbound_source TEXT
    CHECK (inbound_source IS NULL OR inbound_source IN ('PICKUP', 'DIRECT'));

COMMENT ON COLUMN parcels.inbound_source IS '입고 경로: PICKUP=우체국 수거신청, DIRECT=물품등록(타택배)';

UPDATE parcels SET inbound_source = 'PICKUP'
WHERE inbound_source IS NULL
  AND (epost_order_no IS NOT NULL OR epost_req_no IS NOT NULL OR pickup_tracking_no IS NOT NULL);

UPDATE parcels SET inbound_source = 'DIRECT'
WHERE inbound_source IS NULL
  AND status IN ('PRE_REGISTERED', 'PICKED_UP', 'INBOUND', 'INSPECTION');

CREATE INDEX IF NOT EXISTS idx_parcels_inbound_source ON parcels(inbound_source);
