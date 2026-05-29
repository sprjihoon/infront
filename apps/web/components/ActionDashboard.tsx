"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { buildActionCards } from "@/lib/action-dashboard";

const DISMISS_KEY = "action-dashboard-dismissed-date";

function getTodayString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function fetchDashboardData() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { parcels: [], orders: [] };
  }

  const [parcelsRes, ordersRes] = await Promise.all([
    supabase
      .from("parcels")
      .select("id, status, pickup_date, epost_pickup_date"),
    supabase
      .from("orders")
      .select("id, status, total_amount, created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (parcelsRes.error) throw parcelsRes.error;
  if (ordersRes.error) throw ordersRes.error;

  return {
    parcels: parcelsRes.data ?? [],
    orders: ordersRes.data ?? [],
  };
}


export default function ActionDashboard() {
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (stored === getTodayString()) {
      setDismissed(true);
    }
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["action-dashboard"],
    queryFn: fetchDashboardData,
    staleTime: 30_000,
  });

  if (dismissed || isLoading || isError || !data) {
    return null;
  }

  const cards = buildActionCards(data.parcels, data.orders);

  if (cards.length === 0) {
    return null;
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, getTodayString());
    setDismissed(true);
  }

  return (
    <div className="rounded-3xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.09)] overflow-hidden transition-all duration-300">
      {/* Drag handle — 탭하면 접기/펼치기 */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex justify-center pt-3 pb-1 active:opacity-60 transition-opacity"
        aria-label={collapsed ? "펼치기" : "접기"}
      >
        <div className="w-9 h-1 rounded-full bg-gray-200" />
      </button>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-2 pb-3">
        {/* 제목 + 잠시접어두기 */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5 group"
        >
          <h2 className="text-sm font-bold text-gray-700 tracking-tight">진행현황</h2>
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 group-hover:bg-gray-200 group-active:bg-gray-300 transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
            >
              <path d="M2 3.5L5 6.5L8 3.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="text-[10px] text-gray-400 group-hover:text-gray-500 transition-colors">
            {collapsed ? "펼치기" : "잠시접어두기"}
          </span>
        </button>

        {/* 오늘은 그만보기 */}
        <button
          onClick={handleDismiss}
          className="flex flex-col items-center gap-0.5 group"
        >
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 group-hover:bg-gray-200 group-active:bg-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2L10 10M10 2L2 10" stroke="#9CA3AF" strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
          </span>
          <span className="text-[10px] text-gray-400 group-hover:text-gray-500 transition-colors leading-none">
            오늘은 그만보기
          </span>
        </button>
      </div>

      {/* Cards — collapsed 시 숨김 */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          collapsed ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100"
        }`}
      >
        <div className="px-4 pb-4 space-y-2.5">
          {cards.map((card) => (
            <div
              key={card.id}
              className={`rounded-2xl p-4 ${
                card.highlight ? "bg-red-50" : "bg-gray-50"
              }`}
            >
              <p className="text-sm font-medium text-gray-800 leading-snug">
                {card.emoji && <span className="mr-1">{card.emoji}</span>}
                {card.message}
              </p>
              {card.button && (
                <Link
                  href={card.button.href}
                  className={`mt-3 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform ${
                    card.highlight
                      ? "bg-red-500 text-white"
                      : "bg-brand-600 text-white"
                  }`}
                >
                  {card.button.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
