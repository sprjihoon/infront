"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { buildActionCards } from "@/lib/action-dashboard";

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

function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
      <div className="rounded-2xl border bg-white shadow-sm p-4 animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-4/5" />
        <div className="h-10 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}

export default function ActionDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["action-dashboard"],
    queryFn: fetchDashboardData,
    staleTime: 30_000,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return null;
  }

  const cards = buildActionCards(data.parcels, data.orders);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-gray-900">지금 할 일</h2>
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
                    : "bg-blue-600 text-white"
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
