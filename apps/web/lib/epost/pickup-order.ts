/**
 * 반품소포(수거) InsertOrder 파라미터
 *
 * reqType=2 방문반품 — modo shipments-book 동일 매핑:
 *   ord* = 물류센터 (도착지)
 *   rec* = 고객/반품인 (수거지 — 우체국이 방문하는 주소)
 *
 * recAddr2 = 고객 상세주소(동·호수). 비어 있으면 ERR-311 발생.
 */

import type { InsertOrderParams } from './types';
import {
  normalizeEpostAddr1,
  normalizeEpostPhone,
  normalizeEpostZip,
  resolveEpostCenterAddr2,
  resolveEpostPickupAddr2,
} from './client';

export interface ReturnPickupLocation {
  name: string;
  zip: string;
  addr1: string;
  addr2?: string | null;
  phone: string;
}

export interface ReturnPickupCenter {
  ordNm: string;
  zip: string;
  addr1: string;
  addr2: string;
  phone: string;
}

export interface ReturnPickupOrderInput {
  custNo: string;
  apprNo: string;
  officeSer: string;
  orderNo: string;
  center: ReturnPickupCenter;
  pickup: ReturnPickupLocation;
  goodsNm: string;
  weight: number;
  volume: number;
  delivMsg?: string;
  testYn: 'Y' | 'N';
}

/** modo 반품소포(수거) — ord*=센터, rec*=고객 */
export function buildReturnPickupOrderParams(input: ReturnPickupOrderInput): InsertOrderParams {
  const pickupPhone = normalizeEpostPhone(input.pickup.phone);
  const centerPhone = normalizeEpostPhone(input.center.phone);

  return {
    custNo: input.custNo,
    apprNo: input.apprNo,
    payType: '2',
    reqType: '2',
    officeSer: input.officeSer,
    orderNo: input.orderNo,
    // 주문자(물류센터) → ord*
    ordCompNm: input.center.ordNm,
    ordNm:     input.center.ordNm,
    ordZip:    normalizeEpostZip(input.center.zip),
    ordAddr1:  normalizeEpostAddr1(input.center.addr1),
    ordAddr2:  resolveEpostCenterAddr2(input.center.addr2),
    ordMob:    centerPhone,
    // 수취인(반품인=고객) → rec*
    recNm:    input.pickup.name.trim() || '고객',
    recZip:   normalizeEpostZip(input.pickup.zip),
    recAddr1: normalizeEpostAddr1(input.pickup.addr1),
    recAddr2: resolveEpostPickupAddr2(input.pickup.addr2),
    recTel:   pickupPhone,
    contCd: '025',
    goodsNm: input.goodsNm,
    weight: input.weight,
    volume: input.volume,
    microYn: 'N',
    delivMsg: input.delivMsg,
    testYn: input.testYn,
    printYn: 'Y',
    inqTelCn: pickupPhone,
  };
}
