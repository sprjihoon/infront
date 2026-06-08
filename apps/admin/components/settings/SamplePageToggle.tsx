"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2 } from "lucide-react";

type Props = { initialEnabled: boolean };

export default function SamplePageToggle({ initialEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/sample-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setEnabled(data.enabled);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
        <Globe size={20} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">결제 서비스 공개 모드</p>
            <p className="text-xs text-gray-500 mt-0.5">
              ON 시 <span className="font-mono text-gray-700">infront.kr/home</span> 접속하면 <span className="font-mono text-gray-700">/shop</span> 결제 서비스 페이지로 이동합니다.
              KG이니시스 심사 완료 후 반드시 OFF 해주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60 ${
              enabled ? "bg-blue-600" : "bg-gray-300"
            }`}
            aria-checked={enabled}
            role="switch"
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={12} className="animate-spin text-white" />
              </span>
            )}
          </button>
        </div>
        <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${enabled ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-500"}`}>
          현재 상태: <span className="font-semibold">{enabled ? "🟢 결제 서비스 페이지 공개 중" : "⚫ 일반 홈 표시 중"}</span>
        </div>
      </div>
    </div>
  );
}
