"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, ChevronRight, Check, X } from "lucide-react";
import { ITEM_CATEGORIES, ITEM_GROUPS, type ItemCategory } from "@/lib/item-categories";

interface Props {
  value: string;
  onChange: (cat: ItemCategory) => void;
}

export default function ItemCategoryPicker({ value, onChange }: Props) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = ITEM_CATEGORIES.find((c) => c.name_en === value) ?? null;

  // 검색어가 있으면 그룹 펼침 없이 결과만 표시
  const isSearching = query.trim().length > 0;

  const filtered = isSearching
    ? ITEM_CATEGORIES.filter(
        (c) =>
          c.name_ko.toLowerCase().includes(query.toLowerCase()) ||
          c.name_en.toLowerCase().includes(query.toLowerCase()) ||
          c.hs_code.includes(query)
      )
    : ITEM_CATEGORIES;

  const grouped = ITEM_GROUPS.reduce<Record<string, ItemCategory[]>>((acc, g) => {
    const items = filtered.filter((c) => c.group === g);
    if (items.length) acc[g] = items;
    return acc;
  }, {});

  function toggleGroup(g: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }

  function isGroupOpen(g: string) {
    return isSearching || expanded.has(g);
  }

  function select(cat: ItemCategory) {
    onChange(cat);
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // 열릴 때 선택된 항목의 그룹 자동 펼침
  useEffect(() => {
    if (open && selected) {
      setExpanded((prev) => new Set([...prev, selected.group]));
    }
  }, [open, selected]);

  return (
    <>
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-between bg-gray-50 border rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${
          open ? "border-brand-400 ring-2 ring-brand-100" : "border-gray-100"
        }`}
      >
        <div className="flex-1 min-w-0">
          {selected ? (
            <div>
              <span className="text-gray-900 font-medium">{selected.name_ko}</span>
              {selected.hs_code && (
                <span className="ml-2 text-xs text-brand-500 font-mono">HS {selected.hs_code}</span>
              )}
            </div>
          ) : (
            <span className="text-gray-400">품목명을 선택해주세요</span>
          )}
        </div>
        <ChevronDown size={14} className="text-gray-400 shrink-0 ml-2" />
      </button>

      {/* 바텀 시트 */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end items-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => { setOpen(false); setQuery(""); }}
          />

          <div className="relative w-full max-w-[600px] bg-white rounded-t-3xl max-h-[82vh] flex flex-col shadow-2xl">
            {/* 헤더 */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-gray-900">품목명 선택</h3>
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
                  placeholder="한글명, 영문명, HS코드로 검색"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
            </div>

            {/* 목록 */}
            <div className="overflow-y-auto flex-1">
              {Object.keys(grouped).length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">검색 결과가 없습니다</div>
              ) : (
                Object.entries(grouped).map(([group, items]) => {
                  const isOpen = isGroupOpen(group);
                  const hasSelected = items.some((c) => c.name_en === value);
                  return (
                    <div key={group} className="border-b border-gray-50 last:border-0">
                      {/* 그룹 헤더 */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-700">{group}</span>
                          <span className="text-xs text-gray-400">({items.length})</span>
                          {hasSelected && !isSearching && (
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                          )}
                        </div>
                        {isSearching ? null : isOpen ? (
                          <ChevronDown size={15} className="text-gray-400" />
                        ) : (
                          <ChevronRight size={15} className="text-gray-400" />
                        )}
                      </button>

                      {/* 아이템 목록 */}
                      {isOpen && (
                        <div>
                          {items.map((cat) => {
                            const isSel = cat.name_en === value;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => select(cat)}
                                className={`w-full flex items-center justify-between px-5 py-3 text-left border-t border-gray-50 transition-colors ${
                                  isSel ? "bg-brand-50" : "bg-white hover:bg-gray-50 active:bg-brand-50"
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${isSel ? "text-brand-700 font-semibold" : "text-gray-800"}`}>
                                    {cat.name_ko}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                                    {cat.name_en}
                                    {cat.hs_code && (
                                      <span className="ml-2 font-mono text-gray-300">HS {cat.hs_code}</span>
                                    )}
                                  </p>
                                </div>
                                {isSel && <Check size={16} className="text-brand-600 shrink-0 ml-2" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
