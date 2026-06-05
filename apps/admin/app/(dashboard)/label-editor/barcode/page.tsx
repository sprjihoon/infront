"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RotateCcw, Save, Check, Printer, GripVertical } from "lucide-react";
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

// ─── 상수 ────────────────────────────────────────────────────
const MM = 3.7795; // 1mm → px

// ─── 샘플 데이터 ─────────────────────────────────────────────
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

// ─── 드래그 상태 ──────────────────────────────────────────────
interface DragState {
  field: string;
  startPx: number;
  startPy: number;
  origX: number;
  origY: number;
}

// ─── 라벨 미리보기 (드래그 지원) ─────────────────────────────
function LabelPreview({
  s,
  scale,
  highlighted,
  onHighlight,
  onPositionChange,
}: {
  s: BarcodeLabelSettings;
  scale: number;
  highlighted: string | null;
  onHighlight: (key: string | null) => void;
  onPositionChange: (field: string, x: number, y: number) => void;
}) {
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

  const startDrag = useCallback(
    (e: React.PointerEvent, field: string, origX: number, origY: number) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        field,
        startPx: e.clientX,
        startPy: e.clientY,
        origX,
        origY,
      };
      setDragging(field);
      onHighlight(field);
      setTooltip({ x: origX, y: origY });
    },
    [onHighlight]
  );

  const moveDrag = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const realScale = MM * scale;
      const dx = (e.clientX - d.startPx) / realScale;
      const dy = (e.clientY - d.startPy) / realScale;
      const nx = Math.max(0, parseFloat((d.origX + dx).toFixed(1)));
      const ny = Math.max(0, parseFloat((d.origY + dy).toFixed(1)));
      onPositionChange(d.field, nx, ny);
      setTooltip({ x: nx, y: ny });
    },
    [scale, onPositionChange]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDragging(null);
    setTooltip(null);
  }, []);

  // 드래그 핸들 스타일
  const elementStyle = (
    field: string,
    extra?: React.CSSProperties
  ): React.CSSProperties => ({
    position: "absolute",
    cursor: dragging === field ? "grabbing" : "grab",
    userSelect: "none",
    touchAction: "none",
    ...extra,
  });

  const hi = (field: string) =>
    dragging === field || highlighted === field
      ? "ring-2 ring-blue-500 ring-offset-0"
      : "hover:ring-1 hover:ring-blue-300";

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
        overflow: "visible",
        boxSizing: "border-box",
      }}
    >
      {/* 격자 가이드 */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.07,
        }}
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

      {/* ── 바코드 이미지 ── */}
      <div
        className={cn("rounded", hi("barcodeImage"))}
        style={elementStyle("barcodeImage", {
          left: `${s.barcodeImage.x * MM}px`,
          top: `${s.barcodeImage.y * MM}px`,
          width: `${s.barcodeImage.width * MM}px`,
          height: `${s.barcodeImage.height * MM}px`,
        })}
        onPointerDown={(e) =>
          startDrag(e, "barcodeImage", s.barcodeImage.x, s.barcodeImage.y)
        }
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onMouseEnter={() => !dragging && onHighlight("barcodeImage")}
        onMouseLeave={() => !dragging && onHighlight(null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={barcodeImgUrl(SAMPLE.barcode_no)}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            pointerEvents: "none",
          }}
          draggable={false}
        />
      </div>

      {/* ── 고객 코드 ── */}
      {s.customerCode.show && (
        <div
          className={cn("rounded px-0.5", hi("customerCode"))}
          style={elementStyle("customerCode", {
            left: `${s.customerCode.x * MM}px`,
            top: `${s.customerCode.y * MM}px`,
            fontSize: `${s.customerCode.fontSize}pt`,
            fontWeight: s.customerCode.bold ? 700 : 400,
            color: "#555",
            whiteSpace: "nowrap",
          })}
          onPointerDown={(e) =>
            startDrag(e, "customerCode", s.customerCode.x, s.customerCode.y)
          }
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onMouseEnter={() => !dragging && onHighlight("customerCode")}
          onMouseLeave={() => !dragging && onHighlight(null)}
        >
          {SAMPLE.customer_code}
        </div>
      )}

      {/* ── 고객명 ── */}
      {s.customerName.show && (
        <div
          className={cn("rounded px-0.5", hi("customerName"))}
          style={elementStyle("customerName", {
            left: `${s.customerName.x * MM}px`,
            top: `${s.customerName.y * MM}px`,
            fontSize: `${s.customerName.fontSize}pt`,
            fontWeight: s.customerName.bold ? 700 : 400,
            color: "#111",
            whiteSpace: "nowrap",
          })}
          onPointerDown={(e) =>
            startDrag(e, "customerName", s.customerName.x, s.customerName.y)
          }
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onMouseEnter={() => !dragging && onHighlight("customerName")}
          onMouseLeave={() => !dragging && onHighlight(null)}
        >
          {SAMPLE.customer_name}
        </div>
      )}

      {/* ── 바코드 번호 ── */}
      {s.barcodeNo.show && (
        <div
          className={cn("rounded px-0.5", hi("barcodeNo"))}
          style={elementStyle("barcodeNo", {
            left: `${s.barcodeNo.x * MM}px`,
            top: `${s.barcodeNo.y * MM}px`,
            fontSize: `${s.barcodeNo.fontSize}pt`,
            fontWeight: s.barcodeNo.bold ? 700 : 600,
            fontFamily: "monospace",
            letterSpacing: "0.3px",
            whiteSpace: "nowrap",
          })}
          onPointerDown={(e) =>
            startDrag(e, "barcodeNo", s.barcodeNo.x, s.barcodeNo.y)
          }
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onMouseEnter={() => !dragging && onHighlight("barcodeNo")}
          onMouseLeave={() => !dragging && onHighlight(null)}
        >
          {SAMPLE.barcode_no}
        </div>
      )}

      {/* ── 상품명 ── */}
      {s.itemName.show && (
        <div
          className={cn("rounded px-0.5", hi("itemName"))}
          style={elementStyle("itemName", {
            left: `${s.itemName.x * MM}px`,
            top: `${s.itemName.y * MM}px`,
            fontSize: `${s.itemName.fontSize}pt`,
            fontWeight: s.itemName.bold ? 700 : 400,
            color: "#333",
            background: "#f0f4ff",
            borderRadius: "2px",
            padding: "0 2px",
            maxWidth: `${(s.labelWidth - s.itemName.x - 1) * MM}px`,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          })}
          onPointerDown={(e) =>
            startDrag(e, "itemName", s.itemName.x, s.itemName.y)
          }
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onMouseEnter={() => !dragging && onHighlight("itemName")}
          onMouseLeave={() => !dragging && onHighlight(null)}
        >
          {SAMPLE.item_name.slice(0, s.itemName.maxChars)}
        </div>
      )}

      {/* ── 로케이션 ── */}
      {s.location.show && (
        <div
          className={cn("rounded px-0.5", hi("location"))}
          style={elementStyle("location", {
            left: `${s.location.x * MM}px`,
            top: `${s.location.y * MM}px`,
            fontSize: `${s.location.fontSize}pt`,
            fontWeight: s.location.bold ? 700 : 400,
            color: "#2563eb",
            whiteSpace: "nowrap",
          })}
          onPointerDown={(e) =>
            startDrag(e, "location", s.location.x, s.location.y)
          }
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onMouseEnter={() => !dragging && onHighlight("location")}
          onMouseLeave={() => !dragging && onHighlight(null)}
        >
          {SAMPLE.location_code}
        </div>
      )}

      {/* ── 날짜 ── */}
      {s.date.show && (
        <div
          className={cn("rounded px-0.5", hi("date"))}
          style={elementStyle("date", {
            left: `${s.date.x * MM}px`,
            top: `${s.date.y * MM}px`,
            fontSize: `${s.date.fontSize}pt`,
            fontWeight: s.date.bold ? 700 : 400,
            color: "#999",
            whiteSpace: "nowrap",
          })}
          onPointerDown={(e) =>
            startDrag(e, "date", s.date.x, s.date.y)
          }
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onMouseEnter={() => !dragging && onHighlight("date")}
          onMouseLeave={() => !dragging && onHighlight(null)}
        >
          {SAMPLE.date}
        </div>
      )}

      {/* 드래그 중 좌표 툴팁 */}
      {dragging && tooltip && (
        <div
          style={{
            position: "absolute",
            bottom: "-22px",
            left: 0,
            background: "#1e293b",
            color: "white",
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "4px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 100,
          }}
        >
          {dragging} — X: {tooltip.x.toFixed(1)}mm, Y: {tooltip.y.toFixed(1)}mm
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

const TH = "py-1 px-1.5 text-[10px] font-semibold text-gray-400 text-center";
const TD = "py-1 px-1";

// ─── 메인 페이지 ──────────────────────────────────────────────
export default function BarcodeLabelEditorPage() {
  const [s, setS] = useState<BarcodeLabelSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [scale, setScale] = useState(2.6);

  useEffect(() => {
    setS(loadSettings());
  }, []);

  // 최상위 숫자
  const setTop = useCallback(
    <K extends "labelWidth" | "labelHeight">(key: K, val: number) =>
      setS((p) => ({ ...p, [key]: val })),
    []
  );

  // 바코드 이미지 필드
  const setBI = useCallback(
    (key: keyof BarcodeImageField, val: number) =>
      setS((p) => ({ ...p, barcodeImage: { ...p.barcodeImage, [key]: val } })),
    []
  );

  // 텍스트 필드
  const setTF = useCallback(
    (
      field: keyof Omit<
        BarcodeLabelSettings,
        "labelWidth" | "labelHeight" | "barcodeImage"
      >,
      key: keyof TextField | "maxChars",
      val: number | boolean
    ) =>
      setS((p) => ({
        ...p,
        [field]: { ...(p[field] as object), [key]: val },
      })),
    []
  );

  // 드래그로 위치 변경
  const handlePositionChange = useCallback(
    (field: string, x: number, y: number) => {
      if (field === "barcodeImage") {
        setS((p) => ({ ...p, barcodeImage: { ...p.barcodeImage, x, y } }));
      } else {
        setS((p) => ({
          ...p,
          [field]: { ...(p[field as keyof BarcodeLabelSettings] as object), x, y },
        }));
      }
    },
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

  // 텍스트 필드 행
  const TextRow = ({
    label,
    field,
    withMaxChars = false,
    color,
  }: {
    label: string;
    field: keyof Omit<
      BarcodeLabelSettings,
      "labelWidth" | "labelHeight" | "barcodeImage"
    >;
    withMaxChars?: boolean;
    color?: string;
  }) => {
    const f = s[field] as TextField & { maxChars?: number };
    const isHi = highlighted === (field as string);
    return (
      <tr
        className={cn(
          "text-xs transition-colors border-b border-gray-50",
          isHi ? "bg-blue-50" : "hover:bg-gray-50/80"
        )}
        onMouseEnter={() => setHighlighted(field as string)}
        onMouseLeave={() => setHighlighted(null)}
      >
        <td className="py-1.5 pl-2 pr-1 text-gray-700 font-medium whitespace-nowrap">
          <span className="flex items-center gap-1">
            <GripVertical className="h-3 w-3 text-gray-300" />
            <span style={{ color }}>{label}</span>
          </span>
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
          <N
            v={f.fontSize}
            set={(v) => setTF(field, "fontSize", v)}
            step={0.5}
            min={4}
            max={20}
          />
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

  // 미리보기 영역 실제 px 크기 (스케일 적용)
  const previewW = s.labelWidth * MM * scale;
  const previewH = s.labelHeight * MM * scale;

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">제품 바코드 라벨 에디터</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            미리보기에서 필드를 직접 드래그해 위치를 조정하거나, 아래 표에서 값을 입력하세요.
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
              <>
                <Check className="h-3.5 w-3.5" />
                저장됨
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                저장
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── 미리보기 ── */}
        <div className="flex-shrink-0 flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-500">
            미리보기 (샘플 · 드래그로 위치 이동)
          </p>

          {/* 스케일 래퍼 */}
          <div
            style={{
              width: `${previewW}px`,
              height: `${previewH + 30}px`, // 툴팁 공간
            }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                width: `${s.labelWidth * MM}px`,
                height: `${s.labelHeight * MM}px`,
              }}
            >
              <LabelPreview
                s={s}
                scale={scale}
                highlighted={highlighted}
                onHighlight={setHighlighted}
                onPositionChange={handlePositionChange}
              />
            </div>
          </div>

          {/* 라벨 크기 설정 */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mt-2">
            <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-600">
              라벨 크기
            </div>
            <div className="p-2.5 flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-1.5 text-gray-600 text-xs">
                너비 (mm)
                <N v={s.labelWidth} set={(v) => setTop("labelWidth", v)} min={20} max={200} />
              </label>
              <label className="flex items-center gap-1.5 text-gray-600 text-xs">
                높이 (mm)
                <N v={s.labelHeight} set={(v) => setTop("labelHeight", v)} min={10} max={150} />
              </label>
              <span className="text-[10px] text-gray-400">
                {(s.labelWidth / 10).toFixed(1)}cm × {(s.labelHeight / 10).toFixed(1)}cm
              </span>
            </div>
          </div>
        </div>

        {/* ── 설정 패널 ── */}
        <div
          className="flex-1 min-w-0 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 180px)" }}
        >
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
                    "text-xs transition-colors cursor-pointer border-b border-gray-50",
                    highlighted === "barcodeImage"
                      ? "bg-blue-50"
                      : "hover:bg-gray-50/80"
                  )}
                  onMouseEnter={() => setHighlighted("barcodeImage")}
                  onMouseLeave={() => setHighlighted(null)}
                >
                  <td className="py-1.5 pl-2 pr-1 text-gray-700 font-medium">
                    <span className="flex items-center gap-1">
                      <GripVertical className="h-3 w-3 text-gray-300" />
                      바코드 이미지
                    </span>
                  </td>
                  <td className={TD} onClick={(e) => e.stopPropagation()}>
                    <N
                      v={s.barcodeImage.x}
                      set={(v) => setBI("x", v)}
                      min={0}
                      max={s.labelWidth}
                    />
                  </td>
                  <td className={TD} onClick={(e) => e.stopPropagation()}>
                    <N
                      v={s.barcodeImage.y}
                      set={(v) => setBI("y", v)}
                      min={0}
                      max={s.labelHeight}
                    />
                  </td>
                  <td className={TD} onClick={(e) => e.stopPropagation()}>
                    <N
                      v={s.barcodeImage.width}
                      set={(v) => setBI("width", v)}
                      min={5}
                      max={s.labelWidth}
                    />
                  </td>
                  <td className={TD} onClick={(e) => e.stopPropagation()}>
                    <N
                      v={s.barcodeImage.height}
                      set={(v) => setBI("height", v)}
                      min={4}
                      max={s.labelHeight}
                    />
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
            저장 후 입고처리 바코드 인쇄에 즉시 반영됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
