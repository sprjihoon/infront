/**
 * 반품소포(수거) InsertOrder 파라미터
 *
 * reqType=2 방문반품 — 인프론트 우체국 계약 (live API 검증, contCd=025):
 *   ord* = 고객 수거지 (방문·발신, ordAddr1+ordAddr2 분리)
 *   rec* = 물류센터 등록 수취처 (동대구우체국, recAddr2='없음')
 *
 * rec*에 고객 주소를 넣으면 ERR-311(recAddr1/2) 발생.
 */

import type { InsertOrderParams } from './types';
import {
  normalizeEpostAddr1,
  normalizeEpostZip,
  requireEpostPhone,
  resolveEpostCenterAddr2,
  splitPickupAddressForEpost,
} from './client';

const EPOST_ORD_COMP_NM = '인프론트';

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

export function buildReturnPickupOrderParams(input: ReturnPickupOrderInput): InsertOrderParams {
  const pickupPhone = requireEpostPhone(input.pickup.phone, '수거 연락처(ordMob)');
  const centerPhone = requireEpostPhone(input.center.phone, '센터 연락처(recTel)');
  const pickupSplit = splitPickupAddressForEpost(input.pickup.addr1, input.pickup.addr2);

  return {
    custNo: input.custNo,
    apprNo: input.apprNo,
    payType: '2',
    reqType: '2',
    officeSer: input.officeSer,
    orderNo: input.orderNo,
    ordCompNm: EPOST_ORD_COMP_NM,
    ordNm: (input.pickup.name.trim() || '고객').slice(0, 20),
    ordZip: normalizeEpostZip(input.pickup.zip),
    ordAddr1: pickupSplit.addr1,
    ordAddr2: pickupSplit.addr2,
    ordMob: pickupPhone,
    recNm: EPOST_ORD_COMP_NM,
    recZip: normalizeEpostZip(input.center.zip),
    recAddr1: normalizeEpostAddr1(input.center.addr1),
    recAddr2: resolveEpostCenterAddr2(input.center.addr2),
    recTel: centerPhone,
    recMob: centerPhone,
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
