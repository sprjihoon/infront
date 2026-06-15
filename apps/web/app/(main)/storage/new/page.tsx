"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Package } from "lucide-react";
import { Suspense } from "react";
import { Block1SVG, Block2SVG, Block3SVG, Block4SVG, Block5SVG } from "../BlockSVGs";

function shadeColor(hex: string, factor: number): string {
  const h = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
  if (factor >= 1) {
    const t = factor - 1;
    return `#${clamp(r+(255-r)*t).toString(16).padStart(2,"0")}${clamp(g+(255-g)*t).toString(16).padStart(2,"0")}${clamp(b+(255-b)*t).toString(16).padStart(2,"0")}`;
  }
  return `#${clamp(r*factor).toString(16).padStart(2,"0")}${clamp(g*factor).toString(16).padStart(2,"0")}${clamp(b*factor).toString(16).padStart(2,"0")}`;
}

const BLOCK_SVG_MAP: Record<string, React.ComponentType<{ dark: string; medium: string; light: string; size?: number }>> = {
  MINI: Block1SVG, STANDARD: Block2SVG, LONG: Block3SVG, XL: Block4SVG, OVERSIZE: Block5SVG, DEFAULT: Block2SVG,
};

interface StorageType {
  id: string;
  code: string;
  name: string;
  price_per_week: number;
  price_max: number | null;
  price_per_month: number | null;
  max_parcels: number | null;
  volume_liter: number | null;
}

function StorageNewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPlan = searchParams.get("plan"); // storage_type code

  const [types, setTypes] = useState<StorageType[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(preselectedPlan);
  const [storageName, setStorageName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/storage/types")
      .then((r) => r.json())
      .then((d) => {
        const list: StorageType[] = d.types ?? [];
        setTypes(list);
        if (!selectedCode && list.length > 0) {
          setSelectedCode(list[0].code);
        }
      });
  }, []);

  async function handleApply() {
    if (!selectedCode) return;
    setLoading(true);
    try {
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_mode: "long_term",
          plan_type: selectedCode,
          storage_name: storageName.trim() || undefined,
          status: "ACTIVE",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.storage) {
        alert(json.error ?? "스토리지 생성에 실패했습니다.");
        return;
      }
      router.replace("/storage");
    } catch {
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  const selectedType = types.find((t) => t.code === selectedCode);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1 -ml-1 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">장기보관 신청</h1>
          <p className="text-xs text-gray-400 mt-0.5">월정액 플랜으로 안정적인 장기 보관</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* 안내 */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700 space-y-1">
          <p className="font-bold text-blue-800">📦 장기보관 서비스 안내</p>
          <ul className="space-y-0.5">
            {[
              "수거 신청 시 함께 신청하면 수거 완료 후 바로 보관 시작",
              "선택한 사이즈 기준으로 로케이션 배정 후 주 단위 자동 정산",
              "단기보관: 입고 후 3일 무료, 4일차부터 주 단위 자동 정산 (별도 신청 불필요)",
            ].map((t) => (
              <li key={t} className="flex items-start gap-1.5">
                <span className="mt-0.5">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 사이즈 선택 */}
        <section>
          <p className="text-xs font-bold text-gray-700 mb-2">사이즈 선택</p>
          <div className="space-y-2">
            {types.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">사이즈 목록을 불러오는 중...</div>
            ) : (
              types.map((type) => {
                const isSelected = selectedCode === type.code;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedCode(type.code)}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center gap-3 transition-all ${
                      isSelected ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="w-10 h-10 flex items-center justify-center shrink-0">
                      {(() => {
                        const Comp = BLOCK_SVG_MAP[type.code] ?? Block2SVG;
                        const col = isSelected ? "#6366f1" : "#9ca3af";
                        return <Comp dark={shadeColor(col, 0.5)} medium={col} light={shadeColor(col, 1.5)} size={40} />;
                      })()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-gray-900">{type.name}</span>
                        {type.max_parcels != null && (
                          <span className="text-xs text-gray-400">최대 {type.max_parcels}개</span>
                        )}
                        {type.volume_liter != null && (
                          <span className="text-xs text-gray-400">{type.volume_liter}L</span>
                        )}
                      </div>
                      <span className={`text-xs font-bold mt-1 block ${isSelected ? "text-brand-700" : "text-gray-500"}`}>
                        {(type.price_per_month ?? type.price_per_week * 4).toLocaleString()}원/월
                      </span>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center shrink-0">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* 스토리지 이름 */}
        <section>
          <label className="text-xs font-bold text-gray-700 mb-2 block">
            스토리지 이름 <span className="font-normal text-gray-400">(선택)</span>
          </label>
          <input
            value={storageName}
            onChange={(e) => setStorageName(e.target.value)}
            placeholder="예: 내 여름옷 보관함"
            maxLength={30}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-400"
          />
        </section>

        {/* 합계 */}
        {selectedType && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">월 요금</span>
              <span className="text-lg font-black text-brand-600">
                {(selectedType.price_per_month ?? selectedType.price_per_week * 4).toLocaleString()}원/월
              </span>
            </div>
            <p className="text-xs text-gray-400">로케이션 배정 후 자동 정산</p>
          </div>
        )}

        {/* 수거 신청 연계 안내 */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-start gap-3">
          <Package size={16} className="text-gray-400 mt-0.5 shrink-0" />
          <div className="text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-700">수거 신청과 함께 신청하는 방법</p>
            <p>수거 신청 3단계에서 <strong>장기보관 연계</strong>를 선택하면<br />수거와 보관을 한 번에 신청할 수 있습니다.</p>
          </div>
        </div>

        <button
          onClick={handleApply}
          disabled={!selectedCode || loading}
          className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? "신청 중..." : "장기보관 신청하기"}
        </button>
      </div>
    </div>
  );
}

export default function StorageNewPage() {
  return (
    <Suspense>
      <StorageNewInner />
    </Suspense>
  );
}
