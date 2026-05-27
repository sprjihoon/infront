/**
 * 우체국 계약소포 InsertOrder — 반품 수거 (modo shipments-book pickup 패턴)
 *
 * @see https://github.com/sprjihoon/modo — apps/edge/supabase/functions/shipments-book
 * @see apps/edge/supabase/functions/_shared/epost/order.ts
 *
 * 반품 수거: payType=2(착불), reqType=2(반품소포)
 *   ord* = 물류센터(도착), rec* = 고객(발송) — 송장 7로 시작
 * 1회 신청 = 1박스 = InsertOrder 1회 (다박스 불가, 박스마다 별도 신청)
 *
 * modo 프로덕션 기본: weight=2, volume=60, microYn=N
 * UI에서는 우체국 규격(5/10/20/30kg) 선택 가능 — API에 weight/volume 전달
 */

export type PickupBoxSizeCode =
  | "DEFAULT" // modo 기본 — 2kg / 60cm
  | "SMALL"
  | "MEDIUM"
  | "LARGE"
  | "XL";

export interface PickupBoxSizeSpec {
  code: PickupBoxSizeCode;
  label: string;
  desc: string;
  weight: number;
  volume: number;
}

export const PICKUP_BOX_SIZES: PickupBoxSizeSpec[] = [
  {
    code: "DEFAULT",
    label: "극소형",
    desc: "2kg · 60cm (세변의 합)",
    weight: 2,
    volume: 60,
  },
  {
    code: "SMALL",
    label: "소형",
    desc: "5kg · 80cm (세변의 합)",
    weight: 5,
    volume: 80,
  },
  {
    code: "MEDIUM",
    label: "중형",
    desc: "10kg · 100cm (세변의 합)",
    weight: 10,
    volume: 100,
  },
  {
    code: "LARGE",
    label: "대형",
    desc: "20kg · 120cm (세변의 합)",
    weight: 20,
    volume: 120,
  },
  {
    code: "XL",
    label: "특대형",
    desc: "30kg · 160cm (세변의 합)",
    weight: 30,
    volume: 160,
  },
];

export const PICKUP_BOX_SIZE_MAP = Object.fromEntries(
  PICKUP_BOX_SIZES.map((s) => [s.code, s])
) as Record<PickupBoxSizeCode, PickupBoxSizeSpec>;

/** 반품 수거 — 1박스만 (modo: 1 order = 1 insertOrder) */
export const PICKUP_MAX_BOX_COUNT = 1;

/** modo insertOrder 기본값과 동일 */
export const PICKUP_DEFAULT_SIZE: PickupBoxSizeCode = "DEFAULT";

export interface PickupBoxInput {
  size_code: PickupBoxSizeCode;
}

export function resolvePickupBoxList(input: {
  boxes?: PickupBoxInput[];
  box_count?: number;
  box_size?: PickupBoxSizeCode;
  weight?: number;
  volume?: number;
}): PickupBoxSizeSpec[] {
  if (input.boxes?.length) {
    if (input.boxes.length > 1) {
      throw new Error('반품 수거는 1회 1박스만 가능합니다. 박스마다 수거를 따로 신청해주세요.');
    }
    const spec = PICKUP_BOX_SIZE_MAP[input.boxes[0].size_code];
    if (!spec) throw new Error(`잘못된 박스 규격: ${input.boxes[0].size_code}`);
    return [spec];
  }

  const count = Math.min(
    PICKUP_MAX_BOX_COUNT,
    Math.max(1, Math.floor(input.box_count ?? 1))
  );
  if (count > 1) {
    throw new Error('반품 수거는 1회 1박스만 가능합니다. 박스마다 수거를 따로 신청해주세요.');
  }

  const sizeCode = input.box_size ?? PICKUP_DEFAULT_SIZE;
  const spec = PICKUP_BOX_SIZE_MAP[sizeCode];
  if (!spec) throw new Error(`잘못된 박스 규격: ${sizeCode}`);

  return [spec];
}

export function pickupBoxSummary(spec: PickupBoxSizeSpec): string {
  return `${spec.label} · ${spec.weight}kg · ${spec.volume}cm`;
}

import { formatEpostOrderNo } from './client';

/** 우체국 InsertOrder orderNo — SPB+timestamp+seq (formatEpostOrderNo와 동일) */
export function formatPickupOrderNo(_customerCode: string | undefined, parcelId: string): string {
  const seq = parseInt(parcelId.replace(/[^0-9]/g, '').slice(-6) || '1', 16) % 10000 || 1;
  return formatEpostOrderNo('SPB', seq);
}

export function assertUniquePickupOrderNos(orderNos: string[]): void {
  if (new Set(orderNos).size !== orderNos.length) {
    throw new Error('orderNo 중복 — 고객코드만 사용하면 안 됩니다');
  }
}
