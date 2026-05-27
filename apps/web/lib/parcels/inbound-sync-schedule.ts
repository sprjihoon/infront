import { getKstClock, isKrBusinessDay } from "@/lib/business-days/kr";

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

export function parseTimesFromEnv(raw?: string | null): string[] {
  if (!raw?.trim()) return DEFAULT_INBOUND_SYNC_SCHEDULE.times_kst;
  const times = raw
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return times.length > 0 ? times : DEFAULT_INBOUND_SYNC_SCHEDULE.times_kst;
}

export function normalizeInboundSyncSchedule(input: unknown): InboundSyncSchedule {
  const obj = (input && typeof input === "object" ? input : {}) as Partial<InboundSyncSchedule>;
  const times = Array.isArray(obj.times_kst)
    ? obj.times_kst.map(String).filter((t) => TIME_RE.test(t))
    : parseTimesFromEnv(process.env.INBOUND_SYNC_TIMES_KST);

  const unique = [...new Set(times)].sort();

  if (unique.length === 0) {
    throw new Error("동기화 시간이 하나 이상 필요합니다 (HH:MM 형식).");
  }

  return {
    enabled: obj.enabled !== false,
    times_kst: unique,
  };
}

export function scheduleFromEnv(): InboundSyncSchedule {
  return normalizeInboundSyncSchedule({
    enabled: process.env.INBOUND_SYNC_ENABLED !== "false",
    times_kst: parseTimesFromEnv(process.env.INBOUND_SYNC_TIMES_KST),
  });
}

/** 현재 KST 시각이 설정된 슬롯인지 (cron은 정각 실행 가정) */
export function isInboundSyncSlot(
  schedule: InboundSyncSchedule,
  at: Date = new Date(),
): boolean {
  if (!schedule.enabled || schedule.times_kst.length === 0) return false;
  const { hour, minute } = getKstClock(at);
  const now = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return schedule.times_kst.includes(now);
}

export type InboundSyncRunDecision =
  | { run: true; reason: "scheduled" | "forced" }
  | { run: false; reason: "disabled" | "not_business_day" | "not_scheduled_time" };

export function shouldRunInboundSyncCron(
  schedule: InboundSyncSchedule,
  options?: { force?: boolean; at?: Date },
): InboundSyncRunDecision {
  if (options?.force) return { run: true, reason: "forced" };
  if (!schedule.enabled) return { run: false, reason: "disabled" };
  const at = options?.at ?? new Date();
  if (!isKrBusinessDay(at)) return { run: false, reason: "not_business_day" };
  if (!isInboundSyncSlot(schedule, at)) return { run: false, reason: "not_scheduled_time" };
  return { run: true, reason: "scheduled" };
}

export function formatTimesLabel(times: string[]): string {
  return times.map((t) => `${t}`).join(", ");
}
