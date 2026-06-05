"use client";

import { useState, useEffect, useCallback } from "react";
import { RotateCcw, Save, Check, Printer } from "lucide-react";
import {
  BarcodeLabelSettings,
  BarcodeImageField,
  TextField,
  ItemNameField,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from "@/lib/barcode-label/settings";
import { cn } from "@/lib/utils";

// ─── 샘플 데이터 ────────────────────────────────────────────
const SAMPLE = {
  barcode_no: "573842910234-01",
  customer_code: "C001",
  customer_name: "홍길동",
  item_name: "폴로 셔츠 L사이즈",
  location_code: "A-03-2",
  date: new Date().toLocaleDateString("ko-KR"),
};

function barcodeImgUrl(text: string) {
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(text)}&code=Code128&dpi=203&translate-esc=on`;
}

// ─── 라벨 미리보기 ───────────────────────────────────────────
// 1mm = 3.7795px
const MM = 3.7795;

function LabelPreview({
  s,
  highlighted,
}: {
  s: BarcodeLabelSettings;
  highlighted: string | null;
}) {
  const hi = (key: string) =>
    highlighted === key
      ? "outline outline-[2px] outline-blue-500 bg-blue-100/40"
      : "";

  return (
    <div
      style={{
        position: "relative",
        width: `${s.labelWidth * MM}px`,
        height: `${s.labelHeight * MM}px`,
        border: "1px solid #aaa",
        borderRadius: "3px",
        background: "white",
        fontFamily: "'Malgun Gothic', sans-serif",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* 격자 가이드 */}
      <svg
        style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.07 }}
        width={s.labelWidth * MM}
        height={s.labelHeight * MM}
      >
        {Array.from({ length: Math.floor(s.labelWidth / 5) }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={(i + 1) * 5 * MM}
            y1={0}
            x2={(i + 1) * 5 * MM}
            y2={s.labelHeight * MM}
            stroke="#666"
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: Math.floor(s.labelHeight / 5) }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={(i + 1) * 5 * MM}
            x2={s.labelWidth * MM}
            y2={(i + 1) * 5 * MM}
            stroke="#666"
            strokeWidth={0.5}
          />
        ))}
      </svg>

      {/* 바코드 이미지 */}
      <div
        className={cn("absolute", hi("barcodeImage"))}
        style={{
          left: `${s.barcodeImage.x * MM}px`,
          top: `${s.barcodeImage.y * MM}px`,
          width: `${s.barcodeImage.width * MM}px`,
          height: `${s.barcodeImage.height * MM}px`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={barcodeImgUrl(SAMPLE.barcode_no)}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* 고객 코드 */}
      {s.customerCode.show && (
        <div
          className={cn("absolute whitespace-nowrap", hi("customerCode"))}
          style={{
            left: `${s.customerCode.x * MM}px`,
            top: `${s.customerCode.y * MM}px`,
            fontSize: `${s.customerCode.fontSize}pt`,
            fontWeight: s.customerCode.bold ? 700 : 400,
            color: "#555",
          }}
        >
          {SAMPLE.customer_code}
        </div>
      )}

      {/* 고객명 */}
      {s.customerName.show && (
        <div
          className={cn("absolute whitespace-nowrap", hi("customerName"))}
          style={{
            left: `${s.customerName.x * MM}px`,
            top: `${s.customerName.y * MM}px`,
            fontSize: `${s.customerName.fontSize}pt`,
            fontWeight: s.customerName.bold ? 700 : 400,
            color: "#111",
          }}
        >
          {SAMPLE.customer_name}
        </div>
      )}

      {/* 바코드 번호 */}
      {s.barcodeNo.show && (
        <div
          className={cn("absolute whitespace-nowrap", hi("barcodeNo"))}
          style={{
            left: `${s.barcodeNo.x * MM}px`,
            top: `${s.barcodeNo.y * MM}px`,
            fontSize: `${s.barcodeNo.fontSize}pt`,
            fontWeight: s.barcodeNo.bold ? 700 : 600,
            fontFamily: "monospace",
            letterSpacing: "0.3px",
          }}
        >
          {SAMPLE.barcode_no}
        </div>
      )}

      {/* 상품명 */}
      {s.itemName.show && (
        <div
          className={cn("absolute whitespace-nowrap overflow-hidden", hi("itemName"))}
          style={{
            left: `${s.itemName.x * MM}px`,
            top: `${s.itemName.y * MM}px`,
            fontSize: `${s.itemName.fontSize}pt`,
            fontWeight: s.itemName.bold ? 700 : 400,
            color: "#333",
            background: "#f0f4ff",
            borderRadius: "2px",
            padding: "0 2px",
            maxWidth: `${(s.labelWidth - s.itemName.x - 1) * MM}px`,
            textOverflow: "ellipsis",
          }}
        >
          {SAMPLE.item_name.slice(0, s.itemName.maxChars)}
        </div>
      )}

      {/* 로케이션 */}
      {s.location.show && (
        <div
          className={cn("absolute whitespace-nowrap", hi("location"))}
          style={{
            left: `${s.location.x * MM}px`,
            top: `${s.location.y * MM}px`,
            fontSize: `${s.location.fontSize}pt`,
            fontWeight: s.location.bold ? 700 : 400,
            color: "#2563eb",
          }}
        >
          {SAMPLE.location_code}
        </div>
      )}

      {/* 날짜 */}
      {s.date.show && (
        <div
          className={cn("absolute whitespace-nowrap", hi("date"))}
          style={{
            left: `${s.date.x * MM}px`,
            top: `${s.date.y * MM}px`,
            fontSize: `${s.date.fontSize}pt`,
            fontWeight: s.date.bold ? 700 : 400,
            color: "#999",
          }}
        >
          {SAMPLE.date}
        </div>
      )}
    </div>
  );
}

// ─── 입력 컴포넌트 ───────────────────────────────────────────
function N({
  v,
  set,
  step = 0.5,
  min,
  max,
}: {
  v: number;
  set: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={parseFloat(v.toFixed(2))}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        if (!isNaN(n)) set(n);
      }}
      className="w-14 px-1 py-0.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center"
    />
  );
}

function Toggle({ v, set }: { v: boolean; set: (b: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => set(!v)}
      className={cn(
        "relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors",
        v ? "bg-blue-500" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform",
          v ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

// 헤더 th 스타일
const TH = "py-1 px-1.5 text-[10px] font-semibold text-gray-400 text-center";
const TD = "py-1 px-1";

// ─── 메인 ────────────────────────────────────────────────────
export default function BarcodeLabelEditorPage() {
  const [s, setS] = useState<BarcodeLabelSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [scale, setScale] = useState(2.6);

  useEffect(() => {
    setS(loadSettings());
  }, []);

  // 최상위 숫자 필드 업데이트
  const setTop = useCallback(
    <K extends "labelWidth" | "labelHeight">(key: K, val: number) =>
      setS((p) => ({ ...p, [key]: val })),
    []
  );

  // 바코드 이미지 필드 업데이트
  const setBI = useCallback(
    (key: keyof BarcodeImageField, val: number) =>
      setS((p) => ({ ...p, barcodeImage: { ...p.barcodeImage, [key]: val } })),
    []
  );

  // 텍스트 필드 업데이트
  const setTF = useCallback(
    (
      field: keyof Omit<BarcodeLabelSettings, "labelWidth" | "labelHeight" | "barcodeImage">,
      key: keyof TextField | "maxChars",
      val: number | boolean
    ) =>
      setS((p) => ({
        ...p,
        [field]: { ...(p[field] as object), [key]: val },
      })),
    []
  );

  const handleSave = () => {
    saveSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setS(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  };

  const handlePrintTest = () => {
    const encoded = encodeURIComponent(
      JSON.stringify([
        {
          barcode_no: SAMPLE.barcode_no,
          seq: 1,
          item_name: SAMPLE.item_name,
          customer_name: SAMPLE.customer_name,
          customer_code: SAMPLE.customer_code,
          tracking_no: "573842910234",
          location_code: SAMPLE.location_code,
          inbound_date: SAMPLE.date,
        },
        {
          barcode_no: "573842910234-02",
          seq: 2,
          item_name: "청바지 32인치",
          customer_name: SAMPLE.customer_name,
          customer_code: SAMPLE.customer_code,
          tracking_no: "573842910234",
          location_code: SAMPLE.location_code,
          inbound_date: SAMPLE.date,
        },
      ])
    );
    window.open(`/inbound/test/barcodes?data=${encoded}&auto=0`, "_blank");
  };

  // 텍스트 필드 행 렌더 (show/x/y/fontSize/bold + 선택적 maxChars)
  const TextRow = ({
    label,
    field,
    withMaxChars = false,
    color,
  }: {
    label: string;
    field: keyof Omit<BarcodeLabelSettings, "labelWidth" | "labelHeight" | "barcodeImage">;
    withMaxChars?: boolean;
    color?: string;
  }) => {
    const f = s[field] as TextField & { maxChars?: number };
    const isHi = highlighted === field;
    return (
      <tr
        className={cn(
          "cursor-pointer text-xs transition-colors border-b border-gray-50",
          isHi ? "bg-blue-50" : "hover:bg-gray-50/80"
        )}
        onMouseEnter={() => setHighlighted(field as string)}
        onMouseLeave={() => setHighlighted(null)}
      >
        <td className="py-1.5 pl-2 pr-1 text-gray-700 font-medium whitespace-nowrap">
          <span style={{ color }}>{label}</span>
        </td>
        <td className={TD} onClick={(e) => e.stopPropagation()}>
          <Toggle v={f.show} set={(v) => setTF(field, "show", v)} />
        </td>
        <td className={TD} onClick={(e) => e.stopPropagation()}>
          <N v={f.x} set={(v) => setTF(field, "x", v)} min={0} max={s.labelWidth} />
        </td>
        <td className={TD} onClick={(e) => e.stopPropagation()}>
          <N v={f.y} set={(v) => setTF(field, "y", v)} min={0} max={s.labelHeight} />
        </td>
        <td className={TD} onClick={(e) => e.stopPropagation()}>
          <N v={f.fontSize} set={(v) => setTF(field, "fontSize", v)} step={0.5} min={4} max={20} />
        </td>
        <td className={`${TD} text-center`} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={f.bold}
            onChange={(e) => setTF(field, "bold", e.target.checked)}
            className="cursor-pointer accent-blue-500"
          />
        </td>
        {withMaxChars ? (
          <td className={TD} onClick={(e) => e.stopPropagation()}>
            <N
              v={(f as ItemNameField).maxChars}
              set={(v) => setTF(field, "maxChars", Math.round(v))}
              step={1}
              min={4}
              max={40}
            />
          </td>
        ) : (
          <td />
        )}
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">제품 바코드 라벨 에디터</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            입고 바코드 라벨 레이아웃을 설정합니다. 좌표·크기 단위: mm
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            미리보기
            <input
              type="range"
              min={1.5}
              max={4.5}
              step={0.1}
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-24"
            />
            <span className="text-xs text-gray-400">{Math.round(scale * 100)}%</span>
          </label>
          <button
            type="button"
            onClick={handlePrintTest}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <Printer className="h-3.5 w-3.5" />
            인쇄 테스트
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            초기화
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors",
              saved
                ? "bg-green-500 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            )}
          >
            {saved ? (
              <><Check className="h-3.5 w-3.5" />저장됨</>
            ) : (
              <><Save className="h-3.5 w-3.5" />저장</>
            )}
          </button>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* ── 미리보기 ── */}
        <div className="flex-shrink-0">
          <p className="text-xs font-medium text-gray-500 mb-2">
            미리보기 (샘플 데이터)
            {highlighted && (
              <span className="ml-2 text-blue-500">— {highlighted} 강조</span>
            )}
          </p>
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: `${s.labelWidth * MM * scale}px`,
              height: `${s.labelHeight * MM * scale}px`,
            }}
          >
            <LabelPreview s={s} highlighted={highlighted} />
          </div>
          <p className="text-xs text-gray-400 mt-3 max-w-[200px]">
            행에 마우스를 올리면 해당 요소가 강조됩니다.
          </p>
        </div>

        {/* ── 설정 패널 ── */}
        <div
          className="flex-1 min-w-0 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 200px)" }}
        >
          {/* 라벨 크기 */}
          <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700">
              라벨 크기
            </div>
            <div className="p-3 flex items-center gap-6 text-sm">
              <label className="flex items-center gap-2 text-gray-600">
                너비 (mm)
                <N v={s.labelWidth} set={(v) => setTop("labelWidth", v)} min={20} max={200} />
              </label>
              <label className="flex items-center gap-2 text-gray-600">
                높이 (mm)
                <N v={s.labelHeight} set={(v) => setTop("labelHeight", v)} min={10} max={150} />
              </label>
              <span className="text-xs text-gray-400">
                현재: {s.labelWidth}mm × {s.labelHeight}mm
                {" "}({(s.labelWidth / 10).toFixed(1)}cm × {(s.labelHeight / 10).toFixed(1)}cm)
              </span>
            </div>
          </div>

          {/* 바코드 이미지 */}
          <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700">
              바코드 이미지
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className={`${TH} text-left pl-2`}>필드</th>
                  <th className={TH}>X (mm)</th>
                  <th className={TH}>Y (mm)</th>
                  <th className={TH}>너비 (mm)</th>
                  <th className={TH}>높이 (mm)</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  className={cn(
                    "text-xs transition-colors cursor-pointer",
                    highlighted === "barcodeImage" ? "bg-blue-50" : "hover:bg-gray-50/80"
                  )}
                  onMouseEnter={() => setHighlighted("barcodeImage")}
                  onMouseLeave={() => setHighlighted(null)}
                >
                  <td className="py-1.5 pl-2 pr-1 text-gray-700 font-medium">바코드 이미지</td>
                  <td className={TD} onClick={(e) => e.stopPropagation()}>
                    <N v={s.barcodeImage.x} set={(v) => setBI("x", v)} min={0} max={s.labelWidth} />
                  </td>
                  <td className={TD} onClick={(e) => e.stopPropagation()}>
                    <N v={s.barcodeImage.y} set={(v) => setBI("y", v)} min={0} max={s.labelHeight} />
                  </td>
                  <td className={TD} onClick={(e) => e.stopPropagation()}>
                    <N v={s.barcodeImage.width} set={(v) => setBI("width", v)} min={5} max={s.labelWidth} />
                  </td>
                  <td className={TD} onClick={(e) => e.stopPropagation()}>
                    <N v={s.barcodeImage.height} set={(v) => setBI("height", v)} min={4} max={s.labelHeight} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 텍스트 필드 */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700">
              텍스트 필드
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className={`${TH} text-left pl-2`}>필드</th>
                  <th className={TH}>표시</th>
                  <th className={TH}>X (mm)</th>
                  <th className={TH}>Y (mm)</th>
                  <th className={TH}>폰트 (pt)</th>
                  <th className={TH}>굵게</th>
                  <th className={TH}>최대글자</th>
                </tr>
              </thead>
              <tbody>
                <TextRow label="고객 코드" field="customerCode" color="#555" />
                <TextRow label="고객명" field="customerName" />
                <TextRow label="바코드 번호" field="barcodeNo" />
                <TextRow
                  label="상품명"
                  field="itemName"
                  withMaxChars
                  color="#555"
                />
                <TextRow label="로케이션" field="location" color="#2563eb" />
                <TextRow label="날짜" field="date" color="#999" />
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-2 px-1">
            X/Y 좌표: 라벨 좌상단 기준 (mm). 저장 후 입고처리 바코드 인쇄에 즉시 반영됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
