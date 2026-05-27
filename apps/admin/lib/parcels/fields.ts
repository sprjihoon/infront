/** parcels 테이블 ↔ API/UI 필드 매핑 */
const VOLUME_TO_DB: Record<string, string> = {
  vol_length: "volume_l",
  vol_width: "volume_w",
  vol_height: "volume_h",
};

export function parcelUpdatesFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set([
    "status",
    "weight_actual",
    "vol_length",
    "vol_width",
    "vol_height",
    "is_shippable",
    "hold_reason",
    "notes",
    "inbound_at",
    "tracking_no",
  ]);

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!allowed.has(key)) continue;
    const dbKey = VOLUME_TO_DB[key] ?? key;
    updates[dbKey] = value;
  }
  return updates;
}

export function mapParcelForClient<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    vol_length: row.vol_length ?? row.volume_l ?? null,
    vol_width: row.vol_width ?? row.volume_w ?? null,
    vol_height: row.vol_height ?? row.volume_h ?? null,
  };
}
