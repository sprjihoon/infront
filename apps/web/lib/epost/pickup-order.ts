/**
 * 반품소포(수거) InsertOrder 파라미터 — modo shipments-book 매핑 기준
 * reqType=2, payType=2: ord*=물류센터(도착), rec*=고객(출발)
 */

import type { InsertOrderParams } from './types';
import {
  normalizeEpostAddr1,
  normalizeEpostPhone,
  normalizeEpostZip,
  resolveEpostRecAddr2,
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

/** modo shipments-book 반품소포 매핑 — recMob 없음, inqTelCn=고객 연락처 */
export function buildReturnPickupOrderParams(input: ReturnPickupOrderInput): InsertOrderParams {
  const recZip = normalizeEpostZip(input.pickup.zip);
  const recAddr1 = normalizeEpostAddr1(input.pickup.addr1);
  const recPhone = normalizeEpostPhone(input.pickup.phone);
  const centerPhone = normalizeEpostPhone(input.center.phone);

  return {
    custNo: input.custNo,
    apprNo: input.apprNo,
    payType: '2',
    reqType: '2',
    officeSer: input.officeSer,
    orderNo: input.orderNo,
    ordCompNm: input.center.ordNm,
    ordNm: input.center.ordNm,
    ordZip: normalizeEpostZip(input.center.zip),
    ordAddr1: normalizeEpostAddr1(input.center.addr1),
    ordAddr2: resolveEpostRecAddr2(input.center.addr2),
    ordMob: centerPhone,
    recNm: input.pickup.name.trim() || '고객',
    recZip,
    recAddr1,
    recAddr2: resolveEpostRecAddr2(input.pickup.addr2),
    recTel: recPhone,
    contCd: '025',
    goodsNm: input.goodsNm,
    weight: input.weight,
    volume: input.volume,
    microYn: 'N',
    delivMsg: input.delivMsg,
    testYn: input.testYn,
    printYn: 'Y',
    inqTelCn: recPhone,
  };
}
