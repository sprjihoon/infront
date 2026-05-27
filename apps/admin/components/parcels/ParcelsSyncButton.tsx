"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function ParcelsSyncButton({ source }: { source?: "PICKUP" | "DIRECT" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSync() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/parcels/sync-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, limit: 200 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "동기화 실패");
      setMsg(
        `조회 ${json.checked}건 · 수거 ${json.pickup_updated} · 추적 ${json.tracking_updated} · 입고 ${json.auto_inbound} · 건너뜀 ${json.skipped}`,
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-60"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <RefreshCw size={16} />
        )}
        API 동기화
      </button>
      {msg && <p className="text-xs text-gray-500 max-w-md">{msg}</p>}
    </div>
  );
}
