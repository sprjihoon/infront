import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_INBOUND_SYNC_SCHEDULE,
  INBOUND_SYNC_CONFIG_KEY,
  normalizeInboundSyncSchedule,
  scheduleFromEnv,
  type InboundSyncSchedule,
} from "@/lib/parcels/inbound-sync-schedule";

export async function loadInboundSyncSchedule(
  db: SupabaseClient,
): Promise<InboundSyncSchedule> {
  try {
    const { data, error } = await db
      .from("admin_config")
      .select("value")
      .eq("key", INBOUND_SYNC_CONFIG_KEY)
      .maybeSingle();

    if (error || !data?.value) return scheduleFromEnv();
    return normalizeInboundSyncSchedule(data.value);
  } catch {
    return scheduleFromEnv();
  }
}

export async function saveInboundSyncLastRun(
  db: SupabaseClient,
  payload: {
    at: string;
    decision: string;
    summary?: Record<string, unknown>;
    skipped_reason?: string | null;
  },
): Promise<void> {
  await db.from("admin_config").upsert({
    key: "inbound_sync_last_run",
    value: payload,
    updated_at: new Date().toISOString(),
  });
}

export { DEFAULT_INBOUND_SYNC_SCHEDULE, INBOUND_SYNC_CONFIG_KEY };
export type { InboundSyncSchedule };
