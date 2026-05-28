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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">진행현황</h2>
        <button
          onClick={handleDismiss}
          aria-label="오늘 하루 닫기"
          className="text-gray-400 hover:text-gray-600 active:text-gray-800 p-1 -mr-1 rounded-lg transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="space-y-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`rounded-2xl border bg-white shadow-sm p-4 ${
              card.highlight ? "border-red-400 bg-red-50" : ""
            }`}
          >
            <p className="text-sm font-medium text-gray-900 leading-snug">
              {card.emoji && <span className="mr-1">{card.emoji}</span>}
              {card.message}
            </p>
            {card.button && (
              <Link
                href={card.button.href}
                className={`mt-3 flex w-full items-center justify-center rounded-xl py-3 text-sm font-semibold active:scale-[0.98] transition-transform ${
                  card.highlight
                    ? "bg-red-600 text-white"
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
  );
}
