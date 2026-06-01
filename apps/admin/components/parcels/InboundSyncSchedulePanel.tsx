"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Plus, Trash2, Save } from "lucide-react";
import type { InboundSyncLastRun, InboundSyncSchedule } from "@/lib/parcels/inbound-sync-schedule";

type Props = {
  initialSchedule: InboundSyncSchedule;
  initialLastRun: InboundSyncLastRun | null;
};

function formatLastRun(last: InboundSyncLastRun | null): string {
  if (!last?.at) return "아직 자동 실행 기록 없음";
  const at = new Date(last.at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  if (last.skipped_reason === "not_business_day") return `${at} · 주말/공휴일로 건너뜀`;
  if (last.skipped_reason === "not_scheduled_time") return `${at} · 예약 시각 아님 (cron heartbeat)`;
  if (last.skipped_reason === "disabled") return `${at} · 자동 동기화 꺼짐`;
  const s = last.summary;
  if (s) {
    return `${at} · 조회 ${s.checked ?? 0} · 입고 ${s.auto_inbound ?? 0} · 오류 ${s.errors ?? 0}`;
  }
  return `${at} · ${last.decision ?? "완료"}`;
}

export default function InboundSyncSchedulePanel({ initialSchedule, initialLastRun }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(initialSchedule.enabled);
  const [times, setTimes] = useState<string[]>(initialSchedule.times_kst);
  const [newTime, setNewTime] = useState("11:00");
  const [lastRun, setLastRun] = useState(initialLastRun);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  function addTime() {
    if (!/^\d{2}:\d{2}$/.test(newTime)) {
      setMsg("HH:MM 형식으로 입력하세요 (예: 11:00)");
      return;
    }
    if (times.includes(newTime)) {
      setMsg("이미 등록된 시간입니다.");
      return;
    }
    setTimes([...times, newTime].sort());
    setMsg("");
  }

  function removeTime(t: string) {
    if (times.length <= 1) {
      setMsg("최소 1개 시간은 필요합니다.");
      return;
    }
    setTimes(times.filter((x) => x !== t));
    setMsg("");
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/settings/inbound-sync", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, times_kst: times }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "저장 실패");
      setMsg("저장되었습니다.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-2 text-sm">
          <Clock size={16} className="text-indigo-600" />
          <span className="font-medium text-gray-900">자동 API 동기화</span>
          <span className="text-gray-400">
            {enabled ? `평일 ${times.join(", ")} (KST)` : "꺼짐"}
          </span>
        </div>
        <span className="text-xs text-gray-400">{open ? "접기" : "설정"}</span>
      </button>

      <p className="px-4 pb-3 text-xs text-gray-500 -mt-1">
        주말·공휴일 제외 · 수동 버튼은 언제든 사용 가능 · 마지막 자동 실행: {formatLastRun(lastRun)}
      </p>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-gray-300"
            />
            자동 동기화 사용
          </label>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">실행 시각 (KST, 24시간)</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {times.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-medium"
                >
                  {t}
                  <button type="button" onClick={() => removeTime(t)} className="text-indigo-400 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={addTime}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Plus size={14} />
                추가
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
            >
              <Save size={14} />
              {saving ? "저장 중…" : "저장"}
            </button>
            {msg && <p className="text-xs text-gray-500">{msg}</p>}
          </div>

          <p className="text-[11px] text-gray-400">
            Vercel cron이 매시 정각(08:00~20:00 KST)에 확인합니다. 등록한 시각에만 실제 API 동기화가 실행됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
