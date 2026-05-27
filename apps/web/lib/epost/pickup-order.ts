/**
 * 반품소포(수거) InsertOrder 파라미터
 *
 * reqType=2 방문반품 필드 매핑:
 *   ord* = 주문자/발신자 = 고객 (수거를 요청한 반품인, 소포의 출발지)
 *   rec* = 수취인       = 물류센터 (우체국 계약에 등록된 반품 수취 주소)
 *
 * 주의: rec*에 고객 주소를 넣으면 ERR-311(recAddr1 없음) 발생.
 *       우체국 시스템은 rec*가 계약에 등록된 센터 주소인지 검증한다.
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

/**
 * 방문반품 InsertOrder 파라미터 빌더
 *
 * ord* ← 고객 (수거지, 반품인)
 * rec* ← 물류센터 (우체국 등록 수취처)
 */
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
    // 발신자(고객) → ord*
    ordCompNm: input.pickup.name.trim() || '고객',
    ordNm:     input.pickup.name.trim() || '고객',
    ordZip:    normalizeEpostZip(input.pickup.zip),
    ordAddr1:  normalizeEpostAddr1(input.pickup.addr1),
    ordAddr2:  resolveEpostRecAddr2(input.pickup.addr2),
    ordMob:    pickupPhone,
    // 수취인(물류센터) → rec*
    recNm:    input.center.ordNm,
    recZip:   normalizeEpostZip(input.center.zip),
    recAddr1: normalizeEpostAddr1(input.center.addr1),
    recAddr2: resolveEpostRecAddr2(input.center.addr2),
    recTel:   centerPhone,
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
