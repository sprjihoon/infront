export const CARD_THEME_MAP: Record<string, { bg: string; accent: string }> = {
  red:    { bg: "linear-gradient(160deg,#3a0e0e 0%,#5c1a1a 60%,#280a0a 100%)", accent: "#ef4444" },
  green:  { bg: "linear-gradient(160deg,#0d2b18 0%,#1a4d2e 60%,#0a1f12 100%)", accent: "#22c55e" },
  yellow: { bg: "linear-gradient(160deg,#2b1f00 0%,#4d3800 60%,#1a1200 100%)", accent: "#eab308" },
  blue:   { bg: "linear-gradient(160deg,#0c1f3d 0%,#1a3060 60%,#070f28 100%)", accent: "#3b82f6" },
  black:  { bg: "linear-gradient(160deg,#0a0a0a 0%,#1a1a1a 60%,#050505 100%)", accent: "#374151" },
};

export const CARD_THEME_KEYS = Object.keys(CARD_THEME_MAP) as (keyof typeof CARD_THEME_MAP)[];
