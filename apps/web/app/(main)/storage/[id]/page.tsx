"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Package, RefreshCw, Plus, Tag,
  MapPin, CheckCircle, Clock, AlertTriangle,
  XCircle, Archive, Edit3, X, Check, ChevronDown,
  CreditCard, Loader2, TruckIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PlanConfig {
  label_ko: string;
  label_en: string;
  weekly_rate: number | null;
  monthly_amount: number | null;
}

interface Storage {
  id: string;
  storage_name: string;
  storage_mode: "short_term" | "long_term";
  plan_type: string | null;
  current_plan_type: string | null;
  max_plan_type: string | null;
  monthly_amount: number | null;
  capacity_score: number | null;
  used_score: number;
  usage_percent: number;
  status: string;
  short_term_started_at: string | null;
  paid_until_date: string | null;
  next_billing_date: string | null;
  created_at: string;
  storage_plan_config: PlanConfig | null;
}

interface StorageItem {
  id: string;
  product_name: string;
  category: string | null;
  image_url: string | null;
  capacity_score: number;
  location_code: string | null;
  status: string;
  source: string;
  verification_status: string;
  received_at: string | null;
  created_at: string;
}

const ITEM_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING_INBOUND: { label: "입고 대기",  color: "bg-yellow-100 text-yellow-700" },
  IN_STORAGE:      { label: "보관 중",    color: "bg-green-100 text-green-700" },
  PENDING_RELEASE: { label: "출고 요청",  color: "bg-blue-100 text-blue-700" },
  RELEASED:        { label: "출고 완료",  color: "bg-gray-100 text-gray-500" },
};

const CATEGORY_LABELS: Record<string, string> = {
  shirt: "티셔츠",
  pants: "바지",
  coat: "코트",
  padding: "패딩",
  shoes: "신발",
  box_small: "소형 박스",
  box_medium: "중형 박스",
  box_large: "대형 박스",
};

const STORAGE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ACTIVE:    { label: "이용 중",     color: "text-green-600 bg-green-50",   icon: CheckCircle },
  EMPTY:     { label: "비어있음",    color: "text-gray-500 bg-gray-100",    icon: Archive },
  SUSPENDED: { label: "서비스 제한", color: "text-orange-600 bg-orange-50", icon: AlertTriangle },
  OVERDUE:   { label: "장기 미납",   color: "text-red-600 bg-red-50",       icon: XCircle },
};

function CapacityBar({ percent }: { percent: number }) {
  const p = Math.min(Math.max(percent, 0), 100);
  const color = p >= 90 ? "bg-red-500" : p >= 70 ? "bg-orange-400" : "bg-brand-500";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5">
      <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${p}%` }} />
    </div>
  );
}

function calcWeeksUsed(startedAt: string | null): number {
  if (!startedAt) return 0;
  return Math.ceil(
    (Date.now() - new Date(startedAt).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
}

export default function StorageDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [storage, setStorage] = useState<Storage | null>(null);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemFilter, setItemFilter] = useState<string>("ALL");
  const [showReleaseSheet, setShowReleaseSheet] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/storage/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      if (res.status === 404) { router.push("/storage"); return; }
      const json = await res.json();
      setStorage(json.storage);
      setItems(json.items ?? []);
      setNameInput(json.storage?.storage_name ?? "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function saveName() {
    if (!storage || !nameInput.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/storage/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storage_name: nameInput.trim() }),
    });
    if (res.ok) {
      const json = await res.json();
      setStorage((s) => s ? { ...s, storage_name: json.storage.storage_name } : s);
      setEditName(false);
    }
    setSaving(false);
  }

  const filteredItems = itemFilter === "ALL"
    ? items
    : items.filter((it) => it.status === itemFilter);

  const inStorageCount = items.filter((it) => it.status === "IN_STORAGE").length;
  const pendingCount = items.filter((it) => it.status === "PENDING_INBOUND").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!storage) return null;

  const sCfg = STORAGE_STATUS_CONFIG[storage.status] ?? STORAGE_STATUS_CONFIG.ACTIVE;
  const SIcon = sCfg.icon;
  const planLabel = storage.storage_plan_config?.label_ko ?? storage.plan_type ?? "-";
  const weeksUsed = calcWeeksUsed(storage.short_term_started_at);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1 -ml-1 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          {editName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 text-sm font-bold border-b border-brand-400 outline-none bg-transparent"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditName(false); }}
              />
              <button onClick={saveName} disabled={saving} className="p-1 text-green-600">
                <Check size={16} />
              </button>
              <button onClick={() => setEditName(false)} className="p-1 text-gray-400">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditName(true)} className="flex items-center gap-1.5 group">
              <span className="text-base font-bold text-gray-900 truncate">{storage.storage_name}</span>
              <Edit3 size={13} className="text-gray-400 group-hover:text-gray-600 shrink-0" />
            </button>
          )}
          <p className="text-xs text-gray-400">
            {storage.storage_mode === "short_term" ? "단기보관" : "장기보관"}
            {planLabel !== "-" && ` · ${planLabel}`}
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} className="p-2 rounded-full hover:bg-gray-100">
          <RefreshCw size={16} className={`text-gray-400 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* 상태 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${sCfg.color}`}>
              <SIcon size={12} />
              {sCfg.label}
            </span>
            <span className="text-xs text-gray-400">
              신청일 {new Date(storage.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>

          {/* 용량 */}
          {storage.capacity_score != null ? (
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                <span>보관 용량</span>
                <span className="font-semibold">
                  {storage.used_score} / {storage.capacity_score} 점
                  <span className="text-gray-400 ml-1">
                    ({Math.round(storage.usage_percent ?? 0)}%)
                  </span>
                </span>
              </div>
              <CapacityBar percent={storage.usage_percent ?? 0} />
              {(storage.usage_percent ?? 0) >= 90 && (
                <p className="text-xs text-red-600 mt-1.5 font-medium">
                  보관 공간이 거의 가득 찼습니다. 출고 또는 플랜 업그레이드를 고려해 주세요.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 rounded-xl p-3 text-xs text-yellow-700">
              플랜을 선택하면 용량을 관리할 수 있습니다.
            </div>
          )}

          {/* 요금 정보 */}
          <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-3">
            {storage.storage_mode === "short_term" ? (
              <>
                <InfoCell label="보관 기간" value={`${weeksUsed}주 경과`} />
                {storage.storage_plan_config?.weekly_rate != null && (
                  <InfoCell
                    label="주간 요금"
                    value={`${storage.storage_plan_config.weekly_rate.toLocaleString()}원`}
                  />
                )}
                {storage.max_plan_type && (
                  <InfoCell label="최대 사용 플랜" value={storage.max_plan_type + " 플랜"} />
                )}
              </>
            ) : (
              <>
                {storage.paid_until_date && (
                  <InfoCell
                    label="이용 만료일"
                    value={new Date(storage.paid_until_date).toLocaleDateString("ko-KR")}
                  />
                )}
                {storage.next_billing_date && (
                  <InfoCell
                    label="다음 결제일"
                    value={new Date(storage.next_billing_date).toLocaleDateString("ko-KR")}
                  />
                )}
                {storage.monthly_amount != null && (
                  <InfoCell label="월 요금" value={`${storage.monthly_amount.toLocaleString()}원`} />
                )}
              </>
            )}
          </div>
        </div>

        {/* 서비스 제한 안내 */}
        {storage.status === "SUSPENDED" && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-orange-600" />
              <p className="text-sm font-bold text-orange-700">결제 문제로 서비스가 제한되었습니다</p>
            </div>
            <p className="text-xs text-orange-600">
              미납된 금액을 결제하면 서비스가 즉시 복구됩니다.
              문의: support@infront.kr
            </p>
          </div>
        )}

        {/* 단기보관 — 출고 요청 + 정산 버튼 */}
        {storage.storage_mode === "short_term" &&
          storage.status === "ACTIVE" &&
          inStorageCount > 0 && (
            <button
              onClick={() => setShowReleaseSheet(true)}
              className="w-full bg-brand-600 text-white rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 text-sm font-bold shadow-sm"
            >
              <TruckIcon size={16} />
              출고 요청 및 보관료 정산
            </button>
          )}

        {/* 단기보관 — 결제 대기 안내 */}
        {storage.status === "PENDING_PAYMENT" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-bold text-yellow-800 mb-1">수거비 결제 대기 중</p>
            <p className="text-xs text-yellow-700">
              수거비 결제가 완료되지 않았습니다. 신청 페이지로 돌아가 결제를 완료해 주세요.
            </p>
          </div>
        )}

        {/* 내품 목록 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">보관 내품</p>
              <p className="text-xs text-gray-400 mt-0.5">
                보관 중 {inStorageCount}개
                {pendingCount > 0 && ` · 입고 대기 ${pendingCount}개`}
              </p>
            </div>
            <button
              onClick={() => setShowAddItem(true)}
              className="flex items-center gap-1 text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1.5 rounded-xl"
            >
              <Plus size={13} />
              내품 추가
            </button>
          </div>

          {/* 필터 탭 */}
          <div className="flex border-b border-gray-50 px-2">
            {["ALL", "IN_STORAGE", "PENDING_INBOUND", "PENDING_RELEASE"].map((f) => {
              const labels: Record<string, string> = {
                ALL: "전체",
                IN_STORAGE: "보관중",
                PENDING_INBOUND: "입고대기",
                PENDING_RELEASE: "출고요청",
              };
              return (
                <button
                  key={f}
                  onClick={() => setItemFilter(f)}
                  className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    itemFilter === f
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-gray-400"
                  }`}
                >
                  {labels[f]}
                  {f !== "ALL" && items.filter((it) => it.status === f).length > 0 && (
                    <span className="ml-1 bg-gray-100 text-gray-500 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                      {items.filter((it) => it.status === f).length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2">
              <Package size={24} className="text-gray-200" />
              <p className="text-xs text-gray-400">
                {itemFilter === "ALL" ? "내품이 없습니다" : "해당하는 내품이 없습니다"}
              </p>
              {itemFilter === "ALL" && (
                <button
                  onClick={() => setShowAddItem(true)}
                  className="mt-1 text-xs font-semibold text-brand-600 underline"
                >
                  내품 추가하기
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredItems.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* 이용 안내 */}
        <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold text-gray-600">이용 안내</p>
          {[
            "내품은 수거 신청 후 1~2 영업일 내 입고됩니다.",
            "출고 요청 후 당일~1 영업일 내 처리됩니다.",
            "리스트 확인 서비스: 500원/개 (목록 기준 수량 확인)",
            "사진+검품 서비스: 1,000원/개 (사진 촬영 및 전산 등록)",
          ].map((t) => (
            <div key={t} className="flex items-start gap-1.5">
              <span className="text-gray-400 text-xs mt-0.5">•</span>
              <span className="text-xs text-gray-500">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 내품 추가 바텀시트 */}
      {showAddItem && (
        <AddItemSheet
          storageId={id}
          onClose={() => setShowAddItem(false)}
          onAdded={() => { setShowAddItem(false); load(true); }}
        />
      )}

      {/* 출고 요청 + 보관료 정산 바텀시트 */}
      {showReleaseSheet && storage && (
        <ReleasePaymentSheet
          storage={storage}
          onClose={() => setShowReleaseSheet(false)}
        />
      )}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

function ItemRow({ item }: { item: StorageItem }) {
  const s = ITEM_STATUS_MAP[item.status] ?? ITEM_STATUS_MAP.IN_STORAGE;
  const catLabel = item.category ? (CATEGORY_LABELS[item.category] ?? item.category) : null;

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
        <Package size={16} className="text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{item.product_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {catLabel && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <Tag size={9} />
              {catLabel}
            </span>
          )}
          {item.location_code && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <MapPin size={9} />
              {item.location_code}
            </span>
          )}
          {item.capacity_score > 1 && (
            <span className="text-[10px] text-gray-400">{item.capacity_score}점</span>
          )}
        </div>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${s.color}`}>
        {s.label}
      </span>
    </div>
  );
}

const CATEGORIES = [
  { value: "shirt",      label: "티셔츠/상의" },
  { value: "pants",      label: "바지" },
  { value: "coat",       label: "코트/자켓" },
  { value: "padding",    label: "패딩" },
  { value: "shoes",      label: "신발" },
  { value: "box_small",  label: "소형 박스" },
  { value: "box_medium", label: "중형 박스" },
  { value: "box_large",  label: "대형 박스" },
];

function AddItemSheet({
  storageId,
  onClose,
  onAdded,
}: {
  storageId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [rows, setRows] = useState([{ product_name: "", category: "", notes: "" }]);
  const [saving, setSaving] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState<number | null>(null);

  function addRow() {
    setRows((r) => [...r, { product_name: "", category: "", notes: "" }]);
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, field: string, value: string) {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  async function submit() {
    const valid = rows.filter((r) => r.product_name.trim());
    if (!valid.length) return;
    setSaving(true);
    const res = await fetch(`/api/storage/${storageId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: valid.map((r) => ({
          product_name: r.product_name.trim(),
          category: r.category || undefined,
          notes: r.notes || undefined,
        })),
      }),
    });
    setSaving(false);
    if (res.ok) onAdded();
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
          <p className="text-base font-bold text-gray-900">내품 추가</p>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="px-4 py-4 space-y-3">
          <p className="text-xs text-gray-500">
            수거 신청 시 보관할 물품 목록을 입력해 주세요.
            정확한 확인은 센터 입고 후 별도 안내됩니다.
          </p>

          {rows.map((row, i) => (
            <div key={i} className="bg-gray-50 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600">내품 {i + 1}</span>
                {rows.length > 1 && (
                  <button onClick={() => removeRow(i)} className="p-1 text-gray-400">
                    <X size={14} />
                  </button>
                )}
              </div>
              <input
                value={row.product_name}
                onChange={(e) => updateRow(i, "product_name", e.target.value)}
                placeholder="물품명 (예: 패딩 점퍼, 신발 박스)"
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-400"
              />
              <button
                onClick={() => setShowCatPicker(i)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-left flex items-center justify-between"
              >
                <span className={row.category ? "text-gray-800" : "text-gray-400"}>
                  {row.category
                    ? CATEGORIES.find((c) => c.value === row.category)?.label ?? row.category
                    : "카테고리 선택 (선택)"}
                </span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
            </div>
          ))}

          <button
            onClick={addRow}
            className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-2xl text-xs font-semibold text-gray-400 flex items-center justify-center gap-1 hover:border-brand-300 hover:text-brand-600 transition-colors"
          >
            <Plus size={14} />
            내품 추가
          </button>

          <button
            onClick={submit}
            disabled={saving || !rows.some((r) => r.product_name.trim())}
            className="w-full bg-brand-600 text-white text-sm font-bold py-3.5 rounded-2xl disabled:opacity-50 mt-2"
          >
            {saving ? "저장 중..." : "내품 목록 저장"}
          </button>
        </div>
      </div>

      {showCatPicker !== null && (
        <div className="absolute inset-0 bg-black/40 z-10 flex items-end" onClick={() => setShowCatPicker(null)}>
          <div className="w-full bg-white rounded-t-3xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-gray-900 mb-3">카테고리 선택</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => {
                    updateRow(showCatPicker, "category", c.value);
                    setShowCatPicker(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-colors ${
                    rows[showCatPicker]?.category === c.value
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-700"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   출고 요청 + 단기보관 정산 바텀시트
───────────────────────────────────────────── */
function ReleasePaymentSheet({
  storage,
  onClose,
}: {
  storage: Storage;
  onClose: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [payParams, setPayParams] = useState<Record<string, string> | null>(null);
  const [jsUrl, setJsUrl] = useState("");

  const weeksUsed = calcWeeksUsed(storage.short_term_started_at);
  const weeklyRate = storage.storage_plan_config?.weekly_rate ?? 0;
  const maxPlan = storage.max_plan_type ?? storage.current_plan_type ?? storage.plan_type ?? "S";
  const storageFee = weeksUsed * weeklyRate;
  const releaseFee = 1000;
  const totalAmount = storageFee + releaseFee;

  useEffect(() => {
    if (!payParams || !jsUrl) return;
    const prev = document.getElementById("inicis-release-script");
    if (prev) prev.remove();
    const script = document.createElement("script");
    script.id = "inicis-release-script";
    script.src = jsUrl;
    script.onload = () => {
      const INIStdPay = (window as Window & { INIStdPay?: { pay: (id: string) => void } }).INIStdPay;
      if (INIStdPay?.pay) INIStdPay.pay("frmReleasePayment");
    };
    document.head.appendChild(script);
  }, [payParams, jsUrl]);

  async function handlePay() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("customers")
        .select("name, phone, email")
        .eq("id", user?.id ?? "")
        .single();

      const res = await fetch("/api/storage/pay/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_id: storage.id,
          payment_type: "SHORT_TERM_STORAGE",
          buyername: profile?.name ?? "고객",
          buyertel: (profile?.phone ?? "").replace(/[^0-9\-]/g, "") || "010-0000-0000",
          buyeremail: profile?.email ?? "",
          billing_weeks: weeksUsed,
          billing_plan_type: maxPlan,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert(json.error ?? "결제 준비에 실패했습니다.");
        return;
      }
      setJsUrl(json.jsUrl);
      setPayParams(json);
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
          <p className="text-base font-bold text-gray-900">출고 요청 및 보관료 정산</p>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* 정산 내역 */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
            <p className="text-xs font-bold text-gray-600 mb-1">정산 내역</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                단기보관료
                <span className="text-xs text-gray-400 ml-1">
                  ({maxPlan}플랜 {weeksUsed}주 × {weeklyRate.toLocaleString()}원)
                </span>
              </span>
              <span className="font-semibold text-gray-800">{storageFee.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">출고 처리비</span>
              <span className="font-semibold text-gray-800">{releaseFee.toLocaleString()}원</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between">
              <span className="text-sm font-bold text-gray-800">합계</span>
              <span className="text-base font-black text-brand-600">
                {totalAmount.toLocaleString()}원
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            결제 완료 후 출고 처리가 진행됩니다. 배송 정보는 별도 안내됩니다.
          </p>

          <button
            onClick={handlePay}
            disabled={loading || weeksUsed <= 0}
            className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> 처리 중...</>
            ) : (
              <><CreditCard size={16} /> {totalAmount.toLocaleString()}원 결제하기</>
            )}
          </button>
        </div>
      </div>

      {/* KG Inicis 결제 폼 */}
      {payParams && (
        <form
          id="frmReleasePayment"
          ref={formRef}
          method="POST"
          acceptCharset="UTF-8"
          style={{ display: "none" }}
        >
          <input type="hidden" name="version"      value="1.0" />
          <input type="hidden" name="gopaymethod"  value="Card" />
          <input type="hidden" name="mid"          value={payParams.mid} />
          <input type="hidden" name="oid"          value={payParams.oid} />
          <input type="hidden" name="price"        value={payParams.price} />
          <input type="hidden" name="timestamp"    value={payParams.timestamp} />
          <input type="hidden" name="signature"    value={payParams.signature} />
          <input type="hidden" name="verification" value={payParams.verification} />
          <input type="hidden" name="mKey"         value={payParams.mKey} />
          <input type="hidden" name="goodname"     value={payParams.goodname} />
          <input type="hidden" name="buyername"    value={payParams.buyername} />
          <input type="hidden" name="buyertel"     value={payParams.buyertel} />
          <input type="hidden" name="buyeremail"   value={payParams.buyeremail} />
          <input type="hidden" name="currency"     value="WON" />
          <input type="hidden" name="langWallet"   value="ko" />
          <input type="hidden" name="returnUrl"    value={payParams.returnUrl} />
          <input type="hidden" name="closeUrl"     value={payParams.closeUrl} />
          <input type="hidden" name="acceptmethod" value="centerCd(Y):HPP(2)" />
        </form>
      )}
    </div>
  );
}
