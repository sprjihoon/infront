/**
 * 반품소포(수거) InsertOrder 파라미터
 *
 * reqType=2 방문반품 필드 매핑 (로컬 테스트로 regiNo 발급 확인된 기준):
 *   ord* = 주문자/발신자 = 고객 (수거 요청자, 반품인)
 *   rec* = 수취인       = 물류센터 (우체국 계약 등록 수취처)
 *
 * 주의: 인프론트 계약은 rec*=고객 방향이면 ERR-322(recTel 비숫자) 오류 발생.
 *       modo(모두의수선) 계약과 필드 방향이 다름 — 계약 등록 방식 차이.
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
 *
 * contCd=025 + 이 매핑으로 regiNo 발급 확인됨 (2026-05-27 로컬 테스트)
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
    recAddr2: '없음',  // 계약 등록 시 상세주소 없음으로 등록됨 (로컬 테스트 확인)
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
