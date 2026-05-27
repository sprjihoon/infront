export const INBOUND_SYNC_CONFIG_KEY = "inbound_sync_schedule";

export type InboundSyncSchedule = {
  enabled: boolean;
  times_kst: string[];
};

export const DEFAULT_INBOUND_SYNC_SCHEDULE: InboundSyncSchedule = {
  enabled: true,
  times_kst: ["10:00", "13:00", "15:00"],
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeInboundSyncSchedule(input: unknown): InboundSyncSchedule {
  const obj = (input && typeof input === "object" ? input : {}) as Partial<InboundSyncSchedule>;
  const times = Array.isArray(obj.times_kst)
    ? obj.times_kst.map(String).filter((t) => TIME_RE.test(t))
    : DEFAULT_INBOUND_SYNC_SCHEDULE.times_kst;

  const unique = [...new Set(times)].sort();
  if (unique.length === 0) {
    throw new Error("동기화 시간이 하나 이상 필요합니다 (HH:MM 형식).");
  }

  return {
    enabled: obj.enabled !== false,
    times_kst: unique,
  };
}

export type InboundSyncLastRun = {
  at?: string;
  decision?: string;
  skipped_reason?: string | null;
  summary?: {
    checked?: number;
    pickup_updated?: number;
    tracking_updated?: number;
    auto_inbound?: number;
    skipped?: number;
    errors?: number;
  };
};
