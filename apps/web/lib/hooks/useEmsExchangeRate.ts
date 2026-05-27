"use client";

import { useEffect, useState } from "react";

export type EmsExchangeRateInfo = {
  rate: number;
  source: string;
  label: string;
  as_of_date: string;
  as_of_date_display: string;
  updated_at: string;
};

const FALLBACK_RATE = 1400;

export function useEmsExchangeRate() {
  const [info, setInfo] = useState<EmsExchangeRateInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ems/exchange-rate", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: EmsExchangeRateInfo) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loading,
    rate: info?.rate ?? FALLBACK_RATE,
    info,
  };
}
