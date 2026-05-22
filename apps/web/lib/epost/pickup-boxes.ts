/**
 * 우체국 계약소포 InsertOrder.jparcel — 수거(방문접수) 박스 규격
 *
 * API 파라미터 (SEED128 regData 평문):
 *   weight  — 물품중량(kg), 정수. 중량·크기 중 큰 값 기준 요금.
 *   volume  — 물품크기(cm), 가로+세로+높이 합(세변의 합). 엑셀 일괄접수 허용값: 80,100,120,160 등.
 *   microYn — 극소 소포 여부 (Y/N). 계약에 극소 픽업이 포함된 경우 Y + 소형 weight/volume.
 *
 * 참고: 우체국 소포 엑셀 작성 — 물품중량(Kg): 5,10,20,30 / 물품크기(cm): 80,100,120,160
 *       우체국택배 FAQ — 2kg·60cm 구간(극소/마이크로), microYn=Y 시 계약 극소 픽업.
 *       박스 N개 → InsertOrder API N회 호출 → regiNo(운송장) N개 (1회 1송장).
 *
 * @see apps/web/lib/epost/client.ts insertOrder
 * @see https://parcel.epost.go.kr/parcel/webaccess/front/file/sdfab004k04.jsp (엑셀 작성)
 */

export type PickupBoxSizeCode =
  | "MICRO"   // 극소 — microYn Y, 2kg / 60cm
  | "SMALL"   // 소   — 5kg / 80cm  (방문접수 최소 구간)
  | "MEDIUM"  // 중   — 10kg / 100cm
  | "LARGE"   // 대   — 20kg / 120cm
  | "XL";     // 극대 — 30kg / 160cm

export interface PickupBoxSizeSpec {
  code: PickupBoxSizeCode;
  label: string;
  desc: string;
  weight: number;
  volume: number;
  microYn: "Y" | "N";
}

/** 수거 신청 UI / API 에서 선택 가능한 박스 규격
 *  API 검증(2026-05): microYn=Y 미계약 → microYn N 사용
 *  현 계약 유효 구간: 2kg/60cm, 2kg/70cm 등 (5kg/80cm는 ERR-511)
 */
export const PICKUP_BOX_SIZES: PickupBoxSizeSpec[] = [
  {
    code: "MICRO",
    label: "극소",
    desc: "2kg 이하 · 세변합 60cm 이하 (포카·소형 굿즈)",
    weight: 2,
    volume: 60,
    microYn: "N",
  },
  {
    code: "SMALL",
    label: "소",
    desc: "2kg 이하 · 세변합 70cm 이하",
    weight: 2,
    volume: 70,
    microYn: "N",
  },
  {
    code: "MEDIUM",
    label: "중",
    desc: "2kg 이하 · 세변합 70cm 이하 (계약 확장 전)",
    weight: 2,
    volume: 70,
    microYn: "N",
  },
  {
    code: "LARGE",
    label: "대",
    desc: "2kg 이하 · 세변합 70cm 이하 (계약 확장 전)",
    weight: 2,
    volume: 70,
    microYn: "N",
  },
  {
    code: "XL",
    label: "극대",
    desc: "2kg 이하 · 세변합 70cm 이하 (계약 확장 전)",
    weight: 2,
    volume: 70,
    microYn: "N",
  },
];

export const PICKUP_BOX_SIZE_MAP = Object.fromEntries(
  PICKUP_BOX_SIZES.map((s) => [s.code, s])
) as Record<PickupBoxSizeCode, PickupBoxSizeSpec>;

export const PICKUP_MAX_BOX_COUNT = 5;
/** 기본 극소 — UI 기본값. 극소 계약(EPOST_MICRO_PICKUP=Y) 없으면 API에서 안내 */
export const PICKUP_DEFAULT_SIZE: PickupBoxSizeCode = 'SMALL';

export interface PickupBoxInput {
  size_code: PickupBoxSizeCode;
}

export function resolvePickupBoxList(input: {
  boxes?: PickupBoxInput[];
  box_count?: number;
  box_size?: PickupBoxSizeCode;
  /** @deprecated 단일 박스 — box_size/boxes 사용 권장 */
  weight?: number;
  volume?: number;
}): PickupBoxSizeSpec[] {
  if (input.boxes?.length) {
    return input.boxes.map((b, i) => {
      const spec = PICKUP_BOX_SIZE_MAP[b.size_code];
      if (!spec) throw new Error(`박스 ${i + 1}: 잘못된 규격 코드 (${b.size_code})`);
      return spec;
    });
  }

  const count = Math.min(
    PICKUP_MAX_BOX_COUNT,
    Math.max(1, Math.floor(input.box_count ?? 1))
  );
  const sizeCode = input.box_size ?? PICKUP_DEFAULT_SIZE;
  const spec = PICKUP_BOX_SIZE_MAP[sizeCode];
  if (!spec) throw new Error(`잘못된 박스 규격: ${sizeCode}`);

  return Array.from({ length: count }, () => spec);
}

export function pickupBoxSummary(spec: PickupBoxSizeSpec): string {
  const micro = spec.microYn === "Y" ? "극소" : spec.label;
  return `${micro} · ${spec.weight}kg · ${spec.volume}cm`;
}
