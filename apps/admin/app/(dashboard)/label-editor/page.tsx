"use client";

import { useState, useCallback } from "react";
import {
  DomesticLabelSheet,
  DomesticLabelData,
  LabelLayoutElement,
  createDefaultLayout,
} from "@/components/epost/DomesticLabelSheet";
import { RotateCcw, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_DATA: DomesticLabelData = {
  trackingNo: "1234567890123",
  orderDate: "2026-06-04",
  orderNumber: "ORD-2026-00001",
  senderAddress: "경기도 파주시 문발로 242 인프론트 물류센터",
  senderName: "인프론트",
  senderPhone: "031-123-4567",
  recipientName: "홍길동",
  recipientPhone: "010-1234-5678",
  recipientZipcode: "06234",
  recipientAddress: "서울시 강남구 역삼동 456번지 역삼빌딩 302호",
  totalQuantity: 2,
  itemsList: "1. 의류-1개\n2. 잡화-1개",
  weight: "2",
  volume: "60",
  deliveryPlaceCode: "서울남부",
  deliveryTeamCode: "강남",
  deliverySequence: "042",
  sortCode1: "AB",
  sortCode2: "CD",
  sortCode3: "12",
  printAreaCd: "AB CD",
};

const FIELD_LABELS: Record<string, string> = {
  output_label: "소포 라벨",
  sorting_code_large: "분류코드 (대)",
  delivery_center_info: "배달국 정보",
  order_date: "신청일",
  orderer_name: "수령인명",
  order_number: "주문번호",
  package_info: "포장정보",
  zipcode_barcode: "우편번호 바코드",
  total_quantity: "총수량",
  items_list: "상품목록",
  sender_address: "보낸이 주소",
  sender_name: "보낸이 이름",
  sender_phone: "보낸이 전화",
  receiver_address: "받는이 주소",
  receiver_name: "받는이 이름",
  receiver_phone: "받는이 전화",
  tracking_no_text: "등기번호 텍스트",
  waybill_statement: "운송장 안내문",
  tracking_no_barcode: "등기번호 바코드",
  bottom_info: "하단 정보",
};

function NumInput({
  value,
  onChange,
  step = 0.5,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      value={parseFloat(value.toFixed(2))}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(v);
      }}
      className="w-16 px-1 py-0.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center"
    />
  );
}

export default function LabelEditorPage() {
  const [layout, setLayout] = useState<LabelLayoutElement[]>(createDefaultLayout());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.85);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const updateElement = useCallback(
    (index: number, changes: Partial<LabelLayoutElement>) => {
      setLayout((prev) =>
        prev.map((el, i) => (i === index ? { ...el, ...changes } : el))
      );
    },
    []
  );

  const handleReset = () => {
    setLayout(createDefaultLayout());
    setSelectedIndex(null);
  };

  const handleCopy = async () => {
    const code = `const createDefaultLayout = (): LabelLayoutElement[] => [\n${layout
      .map(
        (el) =>
          `  { fieldKey: "${el.fieldKey}", x: ${el.x.toFixed(2)}, y: ${el.y.toFixed(2)}, width: ${el.width.toFixed(2)}, height: ${el.height.toFixed(2)}, fontSize: ${el.fontSize.toFixed(2)}, isBold: ${el.isBold}, type: "${el.type}"${el.letterSpacing != null ? `, letterSpacing: ${el.letterSpacing}` : ""} }`
      )
      .join(",\n")}\n];`;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const textFields = layout.filter((el) => el.type === "text");
  const barcodeFields = layout.filter((el) => el.type === "barcode");

  const renderElementRow = (el: LabelLayoutElement, index: number) => {
    const globalIndex = layout.indexOf(el);
    const isSelected = selectedIndex === globalIndex;

    return (
      <tr
        key={el.fieldKey}
        onClick={() => setSelectedIndex(isSelected ? null : globalIndex)}
        className={cn(
          "cursor-pointer transition-colors text-xs",
          isSelected
            ? "bg-blue-50 border-l-2 border-l-blue-500"
            : "hover:bg-gray-50 border-l-2 border-l-transparent"
        )}
      >
        <td className="py-1.5 pl-2 pr-1 font-medium text-gray-700 whitespace-nowrap">
          {FIELD_LABELS[el.fieldKey] ?? el.fieldKey}
        </td>
        <td className="py-1 px-1" onClick={(e) => e.stopPropagation()}>
          <NumInput value={el.x} onChange={(v) => updateElement(globalIndex, { x: v })} />
        </td>
        <td className="py-1 px-1" onClick={(e) => e.stopPropagation()}>
          <NumInput value={el.y} onChange={(v) => updateElement(globalIndex, { y: v })} />
        </td>
        <td className="py-1 px-1" onClick={(e) => e.stopPropagation()}>
          <NumInput value={el.width} onChange={(v) => updateElement(globalIndex, { width: v })} />
        </td>
        <td className="py-1 px-1" onClick={(e) => e.stopPropagation()}>
          <NumInput value={el.height} onChange={(v) => updateElement(globalIndex, { height: v })} />
        </td>
        {el.type === "text" && (
          <>
            <td className="py-1 px-1" onClick={(e) => e.stopPropagation()}>
              <NumInput
                value={el.fontSize}
                step={0.5}
                onChange={(v) => updateElement(globalIndex, { fontSize: v })}
              />
            </td>
            <td className="py-1 px-2 text-center" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={el.isBold}
                onChange={(e) => updateElement(globalIndex, { isBold: e.target.checked })}
                className="cursor-pointer"
              />
            </td>
          </>
        )}
      </tr>
    );
  };

  const SectionTable = ({
    title,
    fields,
    hasFont,
  }: {
    title: string;
    fields: LabelLayoutElement[];
    hasFont: boolean;
  }) => {
    const key = title;
    const isCollapsed = collapsed[key];

    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
        >
          {title}
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        {!isCollapsed && (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                <th className="text-left py-1 pl-2 pr-1 font-medium">필드</th>
                <th className="py-1 px-1 font-medium">X (mm)</th>
                <th className="py-1 px-1 font-medium">Y (mm)</th>
                <th className="py-1 px-1 font-medium">너비</th>
                <th className="py-1 px-1 font-medium">높이</th>
                {hasFont && (
                  <>
                    <th className="py-1 px-1 font-medium">폰트</th>
                    <th className="py-1 px-1 font-medium">굵게</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fields.map((el) => renderElementRow(el, layout.indexOf(el)))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">송장 레이아웃 에디터</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            국내 우체국 택배 (168×107mm) 라벨 레이아웃을 편집합니다. 단위: mm
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <span>미리보기 크기</span>
            <input
              type="range"
              min={0.5}
              max={1.2}
              step={0.05}
              value={previewScale}
              onChange={(e) => setPreviewScale(parseFloat(e.target.value))}
              className="w-24"
            />
            <span className="text-xs text-gray-400">{Math.round(previewScale * 100)}%</span>
          </label>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            초기화
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors",
              copied
                ? "bg-green-500 text-white"
                : "bg-primary text-white hover:bg-primary/90"
            )}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                복사됨
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                코드 복사
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* Preview */}
        <div className="flex-shrink-0">
          <p className="text-xs font-medium text-gray-500 mb-2">
            미리보기 (샘플 데이터)
            {selectedIndex !== null && (
              <span className="ml-2 text-blue-500">
                — {FIELD_LABELS[layout[selectedIndex]?.fieldKey] ?? layout[selectedIndex]?.fieldKey} 선택됨
              </span>
            )}
          </p>
          <div
            style={{
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
              width: `${635 * previewScale}px`,
              height: `${404 * previewScale}px`,
              flexShrink: 0,
            }}
          >
            <DomesticLabelSheet
              data={MOCK_DATA}
              layout={layout}
              selectedIndex={selectedIndex}
            />
          </div>
        </div>

        {/* Properties panel */}
        <div className="flex-1 min-w-0 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          <p className="text-xs font-medium text-gray-500 mb-2">
            레이아웃 요소 — 행을 클릭하면 미리보기에서 하이라이트됩니다
          </p>

          <SectionTable title="텍스트 요소" fields={textFields} hasFont />
          <SectionTable title="바코드 요소" fields={barcodeFields} hasFont={false} />
        </div>
      </div>
    </div>
  );
}
