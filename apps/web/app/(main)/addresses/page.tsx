"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, MapPin, Globe, Star, Pencil, Trash2,
  Phone, Mail, X, Check, ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AddressSearchButton } from "@/components/ui/AddressSearchButton";

// ?€?€ ?€???€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
type AddrType = "pickup" | "overseas";

interface Address {
  id: string;
  type: AddrType;
  label: string;
  name: string;
  phone: string | null;
  // pickup
  zipcode: string | null;
  address: string | null;
  address_detail: string | null;
  // overseas
  country_code: string | null;
  overseas_addr1: string | null;
  overseas_addr2: string | null;
  overseas_addr3: string | null;
  overseas_zip: string | null;
  email: string | null;
  is_default: boolean;
}

const EMPTY_PICKUP = (): Partial<Address> => ({
  type: "pickup", label: "", name: "", phone: "",
  zipcode: "", address: "", address_detail: "",
});
const EMPTY_OVERSEAS = (): Partial<Address> => ({
  type: "overseas", label: "", name: "", phone: "",
  country_code: "JP", overseas_addr1: "", overseas_addr2: "",
  overseas_addr3: "", overseas_zip: "", email: "",
});

const COUNTRIES = [
  { code: "JP", name: "?¼ë³¸", flag: "?‡¯?‡µ" },
  { code: "CN", name: "ì¤‘êµ­", flag: "?‡¨?‡³" },
  { code: "US", name: "ë¯¸êµ­", flag: "?‡º?‡¸" },
  { code: "AU", name: "?¸ì£¼", flag: "?‡¦?‡º" },
  { code: "CA", name: "ìºë‚˜??, flag: "?‡¨?‡¦" },
  { code: "GB", name: "?êµ­", flag: "?‡¬?‡§" },
  { code: "DE", name: "?…ì¼", flag: "?‡©?‡ª" },
  { code: "FR", name: "?„ë‘??, flag: "?‡«?‡·" },
  { code: "SG", name: "?±ê??¬ë¥´", flag: "?‡¸?‡¬" },
  { code: "HK", name: "?ì½©", flag: "?‡­?‡°" },
  { code: "TW", name: "?€ë§?, flag: "?‡¹?‡¼" },
  { code: "TH", name: "?œêµ­", flag: "?‡¹?‡­" },
  { code: "VN", name: "ë² íŠ¸??, flag: "?‡»?‡³" },
  { code: "PH", name: "?„ë¦¬?€", flag: "?‡µ?‡­" },
  { code: "MY", name: "ë§ë ˆ?´ì‹œ??, flag: "?‡²?‡¾" },
  { code: "ID", name: "?¸ë„?¤ì‹œ??, flag: "?‡®?‡©" },
  { code: "MO", name: "ë§ˆì¹´??, flag: "?‡²?‡´" },
  { code: "MN", name: "ëª½ê³¨", flag: "?‡²?‡³" },
  { code: "NZ", name: "?´ì§ˆ?œë“œ", flag: "?‡³?‡¿" },
  { code: "IT", name: "?´íƒˆë¦¬ì•„", flag: "?‡®?‡¹" },
  { code: "ES", name: "?¤í˜??, flag: "?‡ª?‡¸" },
  { code: "NL", name: "?¤ëœ?€??, flag: "?‡³?‡±" },
  { code: "SE", name: "?¤ì›¨??, flag: "?‡¸?‡ª" },
  { code: "CH", name: "?¤ìœ„??, flag: "?‡¨?‡­" },
  { code: "RU", name: "?¬ì‹œ??, flag: "?‡·?‡º" },
  { code: "BR", name: "ë¸Œë¼ì§?, flag: "?‡§?‡·" },
  { code: "MX", name: "ë©•ì‹œì½?, flag: "?‡²?‡½" },
  { code: "AE", name: "?„ë?ë?ë¦¬íŠ¸", flag: "?‡¦?‡ª" },
  { code: "SA", name: "?¬ìš°?”ì•„?¼ë¹„??, flag: "?‡¸?‡¦" },
  { code: "IN", name: "?¸ë„", flag: "?‡®?‡³" },
];

// ?€?€ ë©”ì¸ ?˜ì´ì§€ ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
export default function AddressesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<AddrType>("pickup");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ëª¨ë‹¬ ?íƒœ
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Address | null>(null);
  const [form, setForm] = useState<Partial<Address>>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);

  // ?€?€ ?°ì´??ë¡œë“œ ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: cust } = await supabase
        .from("customers").select("id").eq("id", user.id).single();
      if (!cust) return;
      setCustomerId(cust.id);

      const { data } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("customer_id", cust.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      setAddresses(data ?? []);
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = addresses.filter(a => a.type === tab);

  // ?€?€ ?€???€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  async function save() {
    if (!customerId) return;
    if (!form.label?.trim()) { alert("?œì‹œëª…ì„ ?…ë ¥?´ì£¼?¸ìš”."); return; }
    if (!form.name?.trim())  { alert("?´ë¦„???…ë ¥?´ì£¼?¸ìš”."); return; }
    if (tab === "pickup" && !form.address?.trim()) { alert("ì£¼ì†Œë¥?ê²€?‰í•´ì£¼ì„¸??"); return; }
    if (tab === "overseas" && !form.overseas_addr3?.trim()) { alert("?ì„¸ì£¼ì†Œë¥??…ë ¥?´ì£¼?¸ìš”."); return; }

    setSaving(true);
    const payload = { ...form, customer_id: customerId, type: tab };

    if (modal === "edit" && editTarget) {
      await supabase.from("customer_addresses").update(payload).eq("id", editTarget.id);
    } else {
      await supabase.from("customer_addresses").insert(payload);
    }
    setSaving(false);
    setModal(null);
    load();
  }

  // ?€?€ ?? œ ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  async function remove(id: string) {
    await supabase.from("customer_addresses").delete().eq("id", id);
    setDeleteConfirm(null);
    load();
  }

  // ?€?€ ê¸°ë³¸ ì£¼ì†Œ ?¤ì • ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  async function setDefault(addr: Address) {
    if (!customerId) return;
    await supabase.from("customer_addresses")
      .update({ is_default: false })
      .eq("customer_id", customerId).eq("type", tab);
    await supabase.from("customer_addresses")
      .update({ is_default: true }).eq("id", addr.id);
    load();
  }

  function openAdd() {
    setForm(tab === "pickup" ? EMPTY_PICKUP() : EMPTY_OVERSEAS());
    setEditTarget(null);
    setModal("add");
  }

  function openEdit(addr: Address) {
    setForm({ ...addr });
    setEditTarget(addr);
    setModal("edit");
  }

  const selCountry = COUNTRIES.find(c => c.code === form.country_code) ?? COUNTRIES[0];

  // ?€?€ UI ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ?¤ë” */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">ì£¼ì†Œë¡?ê´€ë¦?/h1>
          <button
            onClick={openAdd}
            className="ml-auto flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl"
          >
            <Plus size={14} /> ì¶”ê?
          </button>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 pt-4">
        {/* ??*/}
        <div className="flex bg-white rounded-2xl p-1 shadow-sm mb-4">
          {(["pickup", "overseas"] as AddrType[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t
                  ? t === "pickup"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-violet-600 text-white shadow-sm"
                  : "text-gray-400"
              }`}
            >
              {t === "pickup" ? <><MapPin size={14} /> ?˜ê±°ë°°ì†¡ì§€</> : <><Globe size={14} /> ?´ì™¸ë°°ì†¡ì§€</>}
            </button>
          ))}
        </div>

        {/* ì£¼ì†Œ ëª©ë¡ */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center px-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
              tab === "pickup" ? "bg-blue-50" : "bg-violet-50"
            }`}>
              {tab === "pickup"
                ? <MapPin size={28} className="text-blue-300" />
                : <Globe size={28} className="text-violet-300" />}
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">
              {tab === "pickup" ? "?€?¥ëœ ?˜ê±°ì§€ê°€ ?†ì–´?? : "?€?¥ëœ ?´ì™¸ ë°°ì†¡ì§€ê°€ ?†ì–´??}
            </p>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              {tab === "pickup"
                ? "?ì£¼ ?°ëŠ” ?˜ê±°ì§€ë¥??€?¥í•´?ë©´\n?˜ê±° ? ì²­ ??ë¹ ë¥´ê²??…ë ¥?????ˆì–´??"
                : "?ì£¼ ë°œì†¡?˜ëŠ” ?´ì™¸ ?˜ì·¨??ì£¼ì†Œë¥?n?€?¥í•´?ë©´ ë°œì†¡ ??ë°”ë¡œ ? íƒ?????ˆì–´??"}
            </p>
            <button
              onClick={openAdd}
              className={`flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-2xl shadow-sm ${
                tab === "pickup" ? "bg-blue-600" : "bg-violet-600"
              }`}
            >
              <Plus size={16} />
              {tab === "pickup" ? "?˜ê±°ì§€ ì¶”ê??˜ê¸°" : "?´ì™¸ ë°°ì†¡ì§€ ì¶”ê??˜ê¸°"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(addr => (
              <div
                key={addr.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition-all ${
                  addr.is_default
                    ? tab === "pickup" ? "border-blue-200" : "border-violet-200"
                    : "border-transparent"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      tab === "pickup"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-violet-100 text-violet-700"
                    }`}>
                      {addr.label}
                    </span>
                    {addr.is_default && (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                        <Star size={9} fill="currentColor" /> ê¸°ë³¸
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(addr)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(addr.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <p className="text-sm font-semibold text-gray-900">{addr.name}</p>

                {tab === "pickup" ? (
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    [{addr.zipcode}] {addr.address} {addr.address_detail}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    {COUNTRIES.find(c => c.code === addr.country_code)?.flag}{" "}
                    {addr.overseas_addr3}, {addr.overseas_addr2}, {addr.overseas_addr1}
                    {addr.overseas_zip ? ` (${addr.overseas_zip})` : ""}
                  </p>
                )}

                {addr.phone && (
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Phone size={10} /> {addr.phone}
                  </p>
                )}
                {addr.email && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Mail size={10} /> {addr.email}
                  </p>
                )}

                {!addr.is_default && (
                  <button
                    onClick={() => setDefault(addr)}
                    className="mt-2.5 text-[11px] text-gray-400 hover:text-amber-600 transition-colors flex items-center gap-1"
                  >
                    <Star size={11} /> ê¸°ë³¸ ì£¼ì†Œë¡??¤ì •
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ?? œ ?•ì¸ */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8 sm:items-center">
          <div className="w-full max-w-[380px] bg-white rounded-2xl p-5 shadow-xl">
            <p className="text-base font-bold text-gray-900 mb-1">ì£¼ì†Œë¥??? œ? ê¹Œ??</p>
            <p className="text-sm text-gray-500 mb-5">?? œ??ì£¼ì†Œ??ë³µêµ¬?????†ìŠµ?ˆë‹¤.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl"
              >
                ì·¨ì†Œ
              </button>
              <button
                onClick={() => remove(deleteConfirm)}
                className="flex-1 py-3 bg-red-500 text-white text-sm font-semibold rounded-xl"
              >
                ?? œ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ì¶”ê?/?˜ì • ëª¨ë‹¬ */}
      {modal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
          <div
            className="flex-1 flex items-end justify-center sm:items-center"
            onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
          >
            <div className="w-full max-w-[600px] bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* ëª¨ë‹¬ ?¤ë” */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <p className="text-sm font-bold text-gray-800">
                  {tab === "pickup" ? "?˜ê±°ì§€" : "?´ì™¸ ë°°ì†¡ì§€"} {modal === "add" ? "ì¶”ê?" : "?˜ì •"}
                </p>
                <button onClick={() => setModal(null)} className="p-1.5 rounded-full hover:bg-gray-100">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* ëª¨ë‹¬ ??*/}
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                {/* ?œì‹œëª?*/}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    ?œì‹œëª?<span className="text-red-400">*</span>
                  </label>
                  <input
                    value={form.label ?? ""}
                    onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="?? ì§? ?Œì‚¬, ë¶€ëª¨ë‹˜??
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* ?´ë¦„ */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    {tab === "pickup" ? "?˜ê±°ì§€ ?´ë‹¹?? : "?˜ì·¨???´ë¦„"} <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={form.name ?? ""}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="?´ë¦„ ?…ë ¥"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* ?°ë½ì²?*/}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">?°ë½ì²?/label>
                  <input
                    value={form.phone ?? ""}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder={tab === "pickup" ? "010-0000-0000" : "+81-90-0000-0000"}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* ?€?€ ?˜ê±°ì§€ ?„ìš© ?€?€ */}
                {tab === "pickup" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                        ì£¼ì†Œ <span className="text-red-400">*</span>
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          value={form.zipcode ?? ""}
                          readOnly
                          placeholder="?°í¸ë²ˆí˜¸"
                          className="w-24 bg-gray-50 border border-gray-100 rounded-xl px-3 py-3 text-sm text-gray-500"
                        />
                        <AddressSearchButton
                          label="ì£¼ì†Œ ê²€??
                          onSelect={(z, a) => setForm(f => ({ ...f, zipcode: z, address: a, address_detail: "" }))}
                          className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl py-3 flex items-center justify-center gap-1.5"
                        />
                      </div>
                      <input
                        value={form.address ?? ""}
                        readOnly
                        placeholder="?„ë¡œëª?ì£¼ì†Œ"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-500 mb-2"
                      />
                      <input
                        value={form.address_detail ?? ""}
                        onChange={e => setForm(f => ({ ...f, address_detail: e.target.value }))}
                        placeholder="?ì„¸ì£¼ì†Œ (???¸ìˆ˜)"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                  </>
                )}

                {/* ?€?€ ?´ì™¸ ë°°ì†¡ì§€ ?„ìš© ?€?€ */}
                {tab === "overseas" && (
                  <>
                    {/* êµ?? ? íƒ */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                        êµ?? <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setCountryOpen(v => !v)}
                          className="w-full flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm"
                        >
                          <span>{selCountry.flag} {selCountry.name} ({selCountry.code})</span>
                          <ChevronDown size={15} className="text-gray-400" />
                        </button>
                        {countryOpen && (
                          <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                            {COUNTRIES.map(c => (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => { setForm(f => ({ ...f, country_code: c.code })); setCountryOpen(false); }}
                                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-blue-50 text-left ${
                                  form.country_code === c.code ? "text-blue-600 font-semibold" : "text-gray-700"
                                }`}
                              >
                                {c.flag} {c.name}
                                <span className="ml-auto text-xs text-gray-400">{c.code}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* ì£¼ì†Œ */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                        ?ì„¸ì£¼ì†Œ <span className="text-red-400">*</span>
                      </label>
                      <input
                        value={form.overseas_addr3 ?? ""}
                        onChange={e => setForm(f => ({ ...f, overseas_addr3: e.target.value }))}
                        placeholder="Street / ?ì„¸ì£¼ì†Œ"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200 mb-2"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={form.overseas_addr2 ?? ""}
                          onChange={e => setForm(f => ({ ...f, overseas_addr2: e.target.value }))}
                          placeholder="??/ City"
                          className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        <input
                          value={form.overseas_addr1 ?? ""}
                          onChange={e => setForm(f => ({ ...f, overseas_addr1: e.target.value }))}
                          placeholder="ì£¼Â·ë„ / State"
                          className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">?°í¸ë²ˆí˜¸</label>
                      <input
                        value={form.overseas_zip ?? ""}
                        onChange={e => setForm(f => ({ ...f, overseas_zip: e.target.value }))}
                        placeholder="Postal code"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">?´ë©”??/label>
                      <input
                        type="email"
                        value={form.email ?? ""}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="recipient@example.com"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* ?€??ë²„íŠ¼ */}
              <div className="px-5 py-4 border-t border-gray-100 shrink-0">
                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  ?€?¥í•˜ê¸?                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
