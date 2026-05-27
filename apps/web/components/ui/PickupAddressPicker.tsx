"use client";

import { useState, useEffect } from "react";
import { MapPin, Star, Plus, ChevronRight, X, Check, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AddressSearchButton } from "./AddressSearchButton";

export interface PickupAddressValue {
  name: string;
  phone: string;
  zipcode: string;
  address: string;
  addressDetail: string;
  savedId?: string;
  label?: string;
}

interface SavedAddress {
  id: string;
  label: string;
  name: string;
  phone: string | null;
  zipcode: string | null;
  address: string | null;
  address_detail: string | null;
  is_default: boolean;
}

interface Props {
  value: PickupAddressValue | null;
  onChange: (v: PickupAddressValue) => void;
  customerId: string | null;
}

export default function PickupAddressPicker({ value, onChange, customerId }: Props) {
  const [sheet, setSheet] = useState(false);
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [mode, setMode] = useState<"list" | "new">("list");

  const [newLabel, setNewLabel] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newZip, setNewZip] = useState("");
  const [newAddr, setNewAddr] = useState("");
  const [newDetail, setNewDetail] = useState("");
  const [saveOption, setSaveOption] = useState<"save" | "default" | "once">("save");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    loadSaved();
  }, [customerId]);

  async function loadSaved() {
    if (!customerId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("customer_addresses")
      .select("id, label, name, phone, zipcode, address, address_detail, is_default")
      .eq("customer_id", customerId)
      .eq("type", "pickup")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setSaved(data ?? []);

    if (!value && data && data.length > 0) {
      const def = data.find((a) => a.is_default) ?? data[0];
      onChange({
        savedId: def.id,
        label: def.label,
        name: def.name,
        phone: def.phone ?? "",
        zipcode: def.zipcode ?? "",
        address: def.address ?? "",
        addressDetail: def.address_detail ?? "",
      });
    }
  }

  function selectSaved(a: SavedAddress) {
    onChange({
      savedId: a.id,
      label: a.label,
      name: a.name,
      phone: a.phone ?? "",
      zipcode: a.zipcode ?? "",
      address: a.address ?? "",
      addressDetail: a.address_detail ?? "",
    });
    setSheet(false);
  }

  async function confirmNew() {
    if (!newName || !newPhone || !newAddr || !newZip) return;
    setSaving(true);

    try {
      if (saveOption !== "once" && customerId) {
        const supabase = createClient();
        const isDefault = saveOption === "default" || saved.length === 0;

        if (isDefault && saved.some((a) => a.is_default)) {
          await supabase
            .from("customer_addresses")
            .update({ is_default: false })
            .eq("customer_id", customerId)
            .eq("type", "pickup");
        }

        const { data } = await supabase
          .from("customer_addresses")
          .insert({
            customer_id: customerId,
            type: "pickup",
            label: newLabel.trim() || "새 주소",
            name: newName,
            phone: newPhone,
            zipcode: newZip,
            address: newAddr,
            address_detail: newDetail,
            is_default: isDefault,
          })
          .select()
          .single();

        onChange({
          savedId: data?.id,
          label: newLabel.trim() || "새 주소",
          name: newName,
          phone: newPhone,
          zipcode: newZip,
          address: newAddr,
          addressDetail: newDetail,
        });
        await loadSaved();
      } else {
        onChange({
          name: newName,
          phone: newPhone,
          zipcode: newZip,
          address: newAddr,
          addressDetail: newDetail,
        });
      }
    } finally {
      setSaving(false);
      setSheet(false);
      resetNewForm();
    }
  }

  function resetNewForm() {
    setNewLabel(""); setNewName(""); setNewPhone("");
    setNewZip(""); setNewAddr(""); setNewDetail("");
    setSaveOption("save"); setMode("list");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setMode("list"); setSheet(true); }}
        className={`w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
          value
            ? "bg-white border-brand-200 shadow-sm"
            : "bg-gray-50 border-dashed border-gray-300"
        }`}
      >
        {value ? (
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {value.label && (
                  <span className="text-xs font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full shrink-0">
                    {value.label}
                  </span>
                )}
                <span className="text-sm font-semibold text-gray-900 truncate">{value.name}</span>
                <span className="text-sm text-gray-500 shrink-0">{value.phone}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                [{value.zipcode}] {value.address}
                {value.addressDetail ? ` ${value.addressDetail}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-brand-600 text-xs font-medium mt-0.5">
              <Pencil size={12} />
              변경
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-1">
            <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
              <MapPin size={18} className="text-brand-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">수거지를 선택해주세요</p>
              <p className="text-xs text-gray-400 mt-0.5">저장된 주소 선택 또는 새로 입력</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 ml-auto" />
          </div>
        )}
      </button>

      {sheet && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setSheet(false); resetNewForm(); } }}
        >
          <div className="w-full max-w-[560px] bg-white rounded-3xl overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <p className="text-sm font-bold text-gray-900">
                {mode === "list" ? "수거지 선택" : "새 수거지 등록"}
              </p>
              <button
                onClick={() => {
                  if (mode === "new") setMode("list");
                  else { setSheet(false); resetNewForm(); }
                }}
                className="p-1.5 rounded-full hover:bg-gray-100"
              >
                {mode === "new" ? (
                  <span className="text-xs text-brand-500 font-medium px-1">← 목록</span>
                ) : (
                  <X size={18} className="text-gray-500" />
                )}
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {mode === "list" && (
                <div className="p-4 space-y-2">
                  {saved.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <MapPin size={32} className="mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">저장된 수거지가 없어요</p>
                      <p className="text-xs mt-1">새 주소를 등록해보세요</p>
                    </div>
                  ) : (
                    saved.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => selectSaved(a)}
                        className={`w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
                          value?.savedId === a.id
                            ? "border-brand-500 bg-brand-50"
                            : "border-gray-100 bg-gray-50 hover:border-brand-200 hover:bg-brand-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                              {a.label}
                            </span>
                            {a.is_default && (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                <Star size={9} fill="currentColor" /> 기본
                              </span>
                            )}
                          </div>
                          {value?.savedId === a.id && (
                            <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                              <Check size={12} className="text-white" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{a.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          [{a.zipcode}] {a.address} {a.address_detail}
                        </p>
                        {a.phone && (
                          <p className="text-xs text-gray-400 mt-0.5">{a.phone}</p>
                        )}
                      </button>
                    ))
                  )}

                  <button
                    type="button"
                    onClick={() => { resetNewForm(); setMode("new"); }}
                    className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 p-4 text-left hover:border-brand-300 hover:bg-brand-50 transition-all active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      <Plus size={18} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">새 수거지 입력</p>
                      <p className="text-xs text-gray-400 mt-0.5">주소록에 저장하거나 일회성으로 입력</p>
                    </div>
                  </button>
                </div>
              )}

              {mode === "new" && (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      이름 <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="황길동"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      연락처 <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="010-1234-5678"
                      type="tel"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      주소 <span className="text-red-400">*</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        readOnly
                        value={newZip}
                        placeholder="우편번호"
                        className="w-24 bg-gray-50 border border-gray-100 rounded-xl px-3 py-3 text-sm text-gray-500"
                      />
                      <AddressSearchButton
                        label="주소 검색"
                        onSelect={(z, a) => { setNewZip(z); setNewAddr(a); setNewDetail(""); }}
                        className="flex-1 bg-brand-600 text-white text-sm font-semibold rounded-xl py-3 flex items-center justify-center gap-1.5"
                      />
                    </div>
                    <input
                      readOnly
                      value={newAddr}
                      placeholder="도로명 주소"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-500 mb-2"
                    />
                    <input
                      value={newDetail}
                      onChange={(e) => setNewDetail(e.target.value)}
                      placeholder="상세주소 (동·호수, 선택)"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500">저장 방식</p>

                    <button
                      type="button"
                      onClick={() => setSaveOption("save")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                        saveOption === "save" ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        saveOption === "save" ? "border-brand-500 bg-brand-500" : "border-gray-300"
                      }`}>
                        {saveOption === "save" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-semibold text-gray-800">주소록에 저장</p>
                        <p className="text-xs text-gray-500 mt-0.5">별칭을 지정해 다음에도 빠르게 선택</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSaveOption("default")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                        saveOption === "default" ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        saveOption === "default" ? "border-amber-500 bg-amber-500" : "border-gray-300"
                      }`}>
                        {saveOption === "default" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="text-left flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-800">기본 주소로 저장</p>
                          <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                            <Star size={9} fill="currentColor" /> 기본
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">앱을 열 때마다 자동으로 선택됩니다</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSaveOption("once")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                        saveOption === "once" ? "border-gray-400 bg-gray-50" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        saveOption === "once" ? "border-gray-500 bg-gray-500" : "border-gray-300"
                      }`}>
                        {saveOption === "once" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-semibold text-gray-800">저장하지 않고 사용</p>
                        <p className="text-xs text-gray-500 mt-0.5">이번 신청에만 사용하고 저장하지 않음</p>
                      </div>
                    </button>

                    {(saveOption === "save" || saveOption === "default") && (
                      <div className="pt-1">
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                          별칭 <span className="text-gray-400 font-normal">(예: 집, 회사, 부모님대)</span>
                        </label>
                        <input
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          placeholder={saveOption === "default" ? "기본주소" : "집"}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {mode === "new" && (
              <div className="px-4 pb-6 pt-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  disabled={saving || !newName || !newPhone || !newAddr || !newZip}
                  onClick={confirmNew}
                  className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Check size={16} /> 이 주소로 수거 신청</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}


