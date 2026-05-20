"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";
import { ITEM_CATEGORIES, ITEM_GROUPS, type ItemCategory } from "@/lib/item-categories";

interface Props {
  value: string;         // 현재 선택된 name_en
  onChange: (cat: ItemCategory) => void;
}

export default function ItemCategoryPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = ITEM_CATEGORIES.find((c) => c.name_en === value) ?? null;

  const filtered = query.trim()
    ? ITEM_CATEGORIES.filter(
        (c) =>
          c.name_ko.toLowerCase().includes(query.toLowerCase()) ||
          c.name_en.toLowerCase().includes(query.toLowerCase()) ||
          c.hs_code.includes(query)
      )
    : ITEM_CATEGORIES;

  // 그룹별 묶기
  const grouped = ITEM_GROUPS.reduce<Record<string, ItemCategory[]>>((acc, g) => {
    const items = filtered.filter((c) => c.group === g);
    if (items.length) acc[g] = items;
    return acc;
  }, {});

  function select(cat: ItemCategory) {
    onChange(cat);
    setOpen(false);
    setQuery("");
  }

  // 열릴 때 검색창 포커스
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  return (
    <>
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-between bg-gray-50 border rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${
          open ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-100"
        }`}
      >
        <span className={selected ? "text-gray-900 font-medium" : "text-gray-400"}>
          {selected ? selected.name_ko : "품목 선택 (검색 가능)"}
        </span>
        <ChevronDown size={14} className="text-gray-400 shrink-0 ml-1" />
      </button>

      {/* 바텀 시트 */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* 딤 */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => { setOpen(false); setQuery(""); }}
          />

          {/* 시트 */}
          <div className="relative bg-white rounded-t-3xl max-h-[80vh] flex flex-col shadow-2xl">
            {/* 헤더 */}
            <div className="px-4 pt-4 pb-2">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-gray-900">품목 선택</h3>
                <button
                  onClick={() => { setOpen(false); setQuery(""); }}
                  className="p-1.5 rounded-full hover:bg-gray-100"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* 검색 */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="품목명 또는 HS코드 검색"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>

            {/* 목록 */}
            <div className="overflow-y-auto flex-1 pb-safe">
              {Object.entries(grouped).length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">검색 결과가 없어요</div>
              ) : (
                Object.entries(grouped).map(([group, items]) => (
                  <div key={group}>
                    <div className="px-4 py-2 bg-gray-50 sticky top-0 z-10">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{group}</span>
                    </div>
                    {items.map((cat) => {
                      const isSelected = cat.name_en === value;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => select(cat)}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left border-b border-gray-50 last:border-0 active:bg-blue-50 transition-colors ${
                            isSelected ? "bg-blue-50" : "bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${isSelected ? "text-blue-700 font-semibold" : "text-gray-800"}`}>
                              {cat.name_ko}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {cat.name_en}
                              {cat.hs_code && (
                                <span className="ml-2 font-mono text-gray-300">HS {cat.hs_code}</span>
                              )}
                            </p>
                          </div>
                          {isSelected && (
                            <Check size={16} className="text-blue-600 shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
