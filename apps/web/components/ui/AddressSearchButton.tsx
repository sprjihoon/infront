"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";

interface AddressSearchButtonProps {
  onSelect: (zipcode: string, address: string) => void;
  className?: string;
  label?: string;
}

export function AddressSearchButton({
  onSelect,
  className,
  label = "주소 검색",
}: AddressSearchButtonProps) {
  const onSelectRef = useRef(onSelect);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // iframe 모달에서 postMessage 수신
  useEffect(() => {
    if (!open) return;

    function handler(e: MessageEvent) {
      if (e.data?.type === "ADDRESS_SELECTED") {
        onSelectRef.current(e.data.zipcode, e.data.address);
        setOpen(false);
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "px-4 py-3.5 bg-blue-600 text-white text-sm font-bold rounded-xl active:opacity-80 whitespace-nowrap"
        }
      >
        <span className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4" />
          {label}
        </span>
      </button>

      {/* 인라인 iframe 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/50">
          <div className="flex-1 flex items-end justify-center sm:items-center">
            <div
              className="w-full max-w-[430px] bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
              style={{ height: "520px" }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <p className="text-sm font-bold text-gray-800">주소 검색</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <iframe
                src="/postcode.html"
                className="flex-1 border-0"
                title="주소 검색"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
