"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, Package, RefreshCw } from "lucide-react";

interface BoxFee {
  size_code: string;
  label_ko: string;
  desc_ko: string | null;
  weight_kg: number;
  volume_cm: number;
  pickup_fee: number;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
}

export default function PickupFeesPage() {
  const [fees, setFees] = useState<BoxFee[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pickup-box-fees");
      const json = await res.json();
      setFees(json.fees ?? []);
      setEdits({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleChange(code: string, val: string) {
    const num = parseInt(val.replace(/[^0-9]/g, ""), 10);
    setEdits((prev) => ({ ...prev, [code]: isNaN(num) ? 0 : num }));
    setSaved(false);
    setError("");
  }

  const isDirty = Object.keys(edits).length > 0;

  async function handleSave() {
    if (!isDirty) return;
    setSaving(true);
    setError("");
    try {
      const updates = Object.entries(edits).map(([size_code, pickup_fee]) => ({
        size_code,
        pickup_fee,
      }));
      const res = await fetch("/api/admin/pickup-box-fees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "저장 실패");
        return;
      }
      setSaved(true);
      await load();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const currentFee = (code: string, original: number) =>
    edits[code] !== undefined ? edits[code] : original;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">수거 요금 설정</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            박스 크기별 수거비를 설정합니다. 변경 즉시 신규 신청에 반영됩니다.
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          title="새로고침"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> 불러오는 중...
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
              <span className="w-20">박스 크기</span>
              <span>사양</span>
              <span className="w-28 text-right">현재 요금</span>
              <span className="w-32 text-right">수정 요금</span>
            </div>

            <div className="divide-y divide-gray-50">
              {fees.map((fee) => {
                const isEdited = edits[fee.size_code] !== undefined;
                const val = currentFee(fee.size_code, fee.pickup_fee);
                return (
                  <div
                    key={fee.size_code}
                    className={`grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-3 transition-colors ${
                      isEdited ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    {/* 박스 크기 */}
                    <div className="w-20 flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                        fee.is_active ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-400"
                      }`}>
                        <Package size={14} />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{fee.label_ko}</span>
                    </div>

                    {/* 사양 */}
                    <div>
                      <p className="text-xs text-gray-500">{fee.desc_ko}</p>
                    </div>

                    {/* 현재 요금 */}
                    <div className="w-28 text-right">
                      <span className="text-sm text-gray-600">
                        {fee.pickup_fee.toLocaleString()}원
                      </span>
                    </div>

                    {/* 수정 입력 */}
                    <div className="w-32">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={val === 0 ? "" : val.toLocaleString()}
                          onChange={(e) => handleChange(fee.size_code, e.target.value)}
                          placeholder={fee.pickup_fee.toLocaleString()}
                          className={`w-full text-right pr-7 pl-2 py-1.5 text-sm rounded-lg border outline-none transition-colors ${
                            isEdited
                              ? "border-blue-400 bg-white text-blue-800 font-semibold"
                              : "border-gray-200 bg-gray-50 text-gray-700"
                          } focus:border-blue-400 focus:bg-white`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 변경 안내 */}
          {isDirty && (
            <div className="mt-3 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
              {Object.keys(edits).length}개 항목이 변경되었습니다. 저장 버튼을 눌러 적용하세요.
            </div>
          )}

          {error && (
            <p className="mt-2 text-xs text-red-600 px-1">{error}</p>
          )}

          {saved && (
            <div className="mt-3 px-4 py-2 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700">
              요금이 저장되었습니다. 신규 보관 신청부터 변경된 요금이 적용됩니다.
            </div>
          )}

          {/* 저장 버튼 */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              {saving ? (
                <><Loader2 size={15} className="animate-spin" /> 저장 중...</>
              ) : (
                <><Save size={15} /> 요금 저장</>
              )}
            </button>
          </div>

          {/* 안내 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs font-semibold text-gray-700 mb-1">안내사항</p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
              <li>요금 변경은 즉시 DB에 반영되며, 신규 보관 신청부터 새 요금이 적용됩니다.</li>
              <li>진행 중인 결제 건에는 영향 없습니다.</li>
              <li>0원으로 설정 시 해당 박스 크기는 무료 수거로 처리됩니다.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
