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
  savedId?: string;      // ?€?¥ëœ ì£¼ì†Œ?ì„œ ? íƒ??ê²½ìš°
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

  // ??ì£¼ì†Œ ?…ë ¥ ??  const [newLabel, setNewLabel] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newZip, setNewZip] = useState("");
  const [newAddr, setNewAddr] = useState("");
  const [newDetail, setNewDetail] = useState("");
  const [saveToBook, setSaveToBook] = useState(true);
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

    // ê¸°ë³¸ ì£¼ì†Œ ?ë™ ì±„ì? (?„ì§ ? íƒ ????ê²½ìš°)
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

    if (saveToBook && customerId) {
      const supabase = createClient();
      const { data } = await supabase
        .from("customer_addresses")
        .insert({
          customer_id: customerId,
          type: "pickup",
          label: newLabel || "??ì£¼ì†Œ",
          name: newName,
          phone: newPhone,
          zipcode: newZip,
          address: newAddr,
          address_detail: newDetail,
          is_default: saved.length === 0, // ì²?ì£¼ì†Œë©?ê¸°ë³¸ê°’ìœ¼ë¡?        })
        .select()
        .single();

      onChange({
        savedId: data?.id,
        label: newLabel || "??ì£¼ì†Œ",
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

    setSaving(false);
    setSheet(false);
    resetNewForm();
  }

  function resetNewForm() {
    setNewLabel(""); setNewName(""); setNewPhone("");
    setNewZip(""); setNewAddr(""); setNewDetail("");
    setSaveToBook(true); setMode("list");
  }

  function openNew() {
    resetNewForm();
    setMode("new");
  }

  return (
    <>
      {/* ? íƒ??ì£¼ì†Œ ì¹´ë“œ */}
      <button
        type="button"
        onClick={() => { setMode("list"); setSheet(true); }}
        className={`w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
          value
            ? "bg-white border-blue-200 shadow-sm"
            : "bg-gray-50 border-dashed border-gray-300"
        }`}
      >
        {value ? (
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {value.label && (
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0">
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
            <div className="flex items-center gap-1 shrink-0 text-blue-600 text-xs font-medium mt-0.5">
              <Pencil size={12} />
              ë³€ê²?            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-1">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <MapPin size={18} className="text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">?˜ê±°ì§€ë¥?? íƒ?´ì£¼?¸ìš”</p>
              <p className="text-xs text-gray-400 mt-0.5">?€?¥ëœ ì£¼ì†Œ ? íƒ ?ëŠ” ?ˆë¡œ ?…ë ¥</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 ml-auto" />
          </div>
        )}
      </button>

      {/* ë°”í??œíŠ¸ ?¤ë²„?ˆì´ */}
      {sheet && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) { setSheet(false); resetNewForm(); } }}
        >
          <div className="w-full max-w-[600px] bg-white rounded-t-3xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* ?œíŠ¸ ?¤ë” */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <p className="text-sm font-bold text-gray-900">
                {mode === "list" ? "?˜ê±°ì§€ ? íƒ" : "???˜ê±°ì§€ ?±ë¡"}
              </p>
              <button
                onClick={() => {
                  if (mode === "new") { setMode("list"); }
                  else { setSheet(false); resetNewForm(); }
                }}
                className="p-1.5 rounded-full hover:bg-gray-100"
              >
                {mode === "new" ? (
                  <span className="text-xs text-gray-500 px-1">??ëª©ë¡</span>
                ) : (
                  <X size={18} className="text-gray-500" />
                )}
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* ?€?€?€ ì£¼ì†Œ ëª©ë¡ ëª¨ë“œ ?€?€?€ */}
              {mode === "list" && (
                <div className="p-4 space-y-2">
                  {saved.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <MapPin size={32} className="mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">?€?¥ëœ ?˜ê±°ì§€ê°€ ?†ì–´??/p>
                      <p className="text-xs mt-1">??ì£¼ì†Œë¥??±ë¡?´ë³´?¸ìš”</p>
                    </div>
                  ) : (
                    saved.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => selectSaved(a)}
                        className={`w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
                          value?.savedId === a.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 bg-gray-50 hover:border-blue-200 hover:bg-blue-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              {a.label}
                            </span>
                            {a.is_default && (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                <Star size={9} fill="currentColor" /> ê¸°ë³¸
                              </span>
                            )}
                          </div>
                          {value?.savedId === a.id && (
                            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
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

                  {/* ??ì£¼ì†Œ ?±ë¡ ë²„íŠ¼ */}
                  <button
                    type="button"
                    onClick={openNew}
                    className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50 transition-all active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      <Plus size={18} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">???˜ê±°ì§€ ?±ë¡</p>
                      <p className="text-xs text-gray-400 mt-0.5">ì£¼ì†Œë¡ì— ?€?¥í•˜ê±°ë‚˜ ?¼íšŒ?±ìœ¼ë¡??…ë ¥</p>
                    </div>
                  </button>
                </div>
              )}

              {/* ?€?€?€ ??ì£¼ì†Œ ?…ë ¥ ëª¨ë“œ ?€?€?€ */}
              {mode === "new" && (
                <div className="p-4 space-y-4">
                  {/* ë³„ì¹­ */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      ë³„ì¹­ <span className="text-gray-400 font-normal">(?? ì§? ?Œì‚¬, ë¶€ëª¨ë‹˜??</span>
                    </label>
                    <input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="ì§?
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* ?´ë¦„ */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      ?´ë¦„ <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="?ê¸¸??
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* ?°ë½ì²?*/}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      ?°ë½ì²?<span className="text-red-400">*</span>
                    </label>
                    <input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="010-1234-5678"
                      type="tel"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* ì£¼ì†Œ */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      ì£¼ì†Œ <span className="text-red-400">*</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        readOnly
                        value={newZip}
                        placeholder="?°í¸ë²ˆí˜¸"
                        className="w-24 bg-gray-50 border border-gray-100 rounded-xl px-3 py-3 text-sm text-gray-500"
                      />
                      <AddressSearchButton
                        label="ì£¼ì†Œ ê²€??
                        onSelect={(z, a) => { setNewZip(z); setNewAddr(a); setNewDetail(""); }}
                        className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl py-3 flex items-center justify-center gap-1.5"
                      />
                    </div>
                    <input
                      readOnly
                      value={newAddr}
                      placeholder="?„ë¡œëª?ì£¼ì†Œ"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-500 mb-2"
                    />
                    <input
                      value={newDetail}
                      onChange={(e) => setNewDetail(e.target.value)}
                      placeholder="?ì„¸ ì£¼ì†Œ (???¸ìˆ˜)"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* ì£¼ì†Œë¡??€??? ê? */}
                  <button
                    type="button"
                    onClick={() => setSaveToBook(!saveToBook)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                      saveToBook ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      saveToBook ? "bg-blue-600 border-blue-600" : "border-gray-300"
                    }`}>
                      {saveToBook && <Check size={12} className="text-white" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800">ì£¼ì†Œë¡ì— ?€??/p>
                      <p className="text-xs text-gray-500 mt-0.5">?¤ìŒ?ë„ ë¹ ë¥´ê²?? íƒ?????ˆì–´??/p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* ?•ì¸ ë²„íŠ¼ (??ì£¼ì†Œ ëª¨ë“œ???? */}
            {mode === "new" && (
              <div className="px-4 pb-6 pt-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  disabled={saving || !newName || !newPhone || !newAddr || !newZip}
                  onClick={confirmNew}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Check size={16} /> ??ì£¼ì†Œë¡??˜ê±° ? ì²­</>
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
