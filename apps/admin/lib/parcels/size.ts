/**
 * 우체국 택배 규격 기반 소포 크기 코드 → 부피(L) 매핑
 *
 * 리터 = 포인트: 로케이션의 volume_liter 와 직접 비교 가능
 */
export const PARCEL_SIZE_OPTIONS = [
  { code: "SMALL",  label: "소형",  desc: "3변 합 80cm 이하 · 1kg",  volume_l: 8   },
  { code: "MEDIUM", label: "중형",  desc: "3변 합 120cm 이하 · 5kg", volume_l: 30  },
  { code: "LARGE",  label: "대형",  desc: "3변 합 160cm 이하 · 10kg", volume_l: 80  },
  { code: "XLARGE", label: "특대",  desc: "3변 합 200cm 이하 · 20kg", volume_l: 200 },
] as const;

export type ParcelSizeCode = (typeof PARCEL_SIZE_OPTIONS)[number]["code"];

export const SIZE_VOLUME_L: Record<string, number> = Object.fromEntries(
  PARCEL_SIZE_OPTIONS.map((s) => [s.code, s.volume_l])
);
