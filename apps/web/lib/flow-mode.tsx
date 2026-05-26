"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/** 일반모드(단계별) · 고급모드(한 페이지) — 추후 최보모드 전역 진행률과 연동 */
export type FlowMode = "simple" | "advanced";

const STORAGE_KEY = "infront-flow-mode";
const LEGACY_PICKUP_KEY = "pickup-form-mode";

type FlowModeContextValue = {
  mode: FlowMode;
  setMode: (mode: FlowMode) => void;
  isSimple: boolean;
  isAdvanced: boolean;
};

const FlowModeContext = createContext<FlowModeContextValue | null>(null);

function readStoredMode(): FlowMode {
  if (typeof window === "undefined") return "simple";
  const saved =
    localStorage.getItem(STORAGE_KEY) ??
    localStorage.getItem(LEGACY_PICKUP_KEY);
  return saved === "advanced" ? "advanced" : "simple";
}

export function FlowModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<FlowMode>("simple");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setModeState(readStoredMode());
    setHydrated(true);
  }, []);

  const setMode = useCallback((next: FlowMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    localStorage.setItem(LEGACY_PICKUP_KEY, next);
  }, []);

  const value: FlowModeContextValue = {
    mode: hydrated ? mode : "simple",
    setMode,
    isSimple: !hydrated || mode === "simple",
    isAdvanced: hydrated && mode === "advanced",
  };

  return (
    <FlowModeContext.Provider value={value}>{children}</FlowModeContext.Provider>
  );
}

export function useFlowMode() {
  const ctx = useContext(FlowModeContext);
  if (!ctx) {
    throw new Error("useFlowMode must be used within FlowModeProvider");
  }
  return ctx;
}
