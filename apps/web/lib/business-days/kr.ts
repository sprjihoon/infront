/** 대한민국 공휴일 (YYYY-MM-DD, Asia/Seoul 기준) */
export const KR_HOLIDAYS = new Set([
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-03-01",
  "2026-05-05",
  "2026-05-24",
  "2026-06-06",
  "2026-08-15",
  "2026-08-16",
  "2026-09-24",
  "2026-09-25",
  "2026-09-26",
  "2026-10-03",
  "2026-10-09",
  "2026-12-25",
]);

export type KstClock = {
  date: string;
  hour: number;
  minute: number;
  dayOfWeek: number;
};

export function getKstClock(at: Date = new Date()): KstClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(at);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    dayOfWeek: weekdayMap[get("weekday")] ?? 0,
  };
}

/** 평일이며 공휴일이 아닌 영업일 */
export function isKrBusinessDay(at: Date = new Date()): boolean {
  const { date, dayOfWeek } = getKstClock(at);
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  return !KR_HOLIDAYS.has(date);
}
