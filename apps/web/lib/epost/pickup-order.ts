/**
 * 반품소포(수거) InsertOrder 파라미터 — reqType=2
 *
 * 우체국 API 필드 의미 (오류 메시지 기준):
 *   rec* = 수취인(반품인) = 고객 수거지 → recAddr1(도로명) + recAddr2(동·호·층) 필수
 *   ord* = 주문자 = 물류센터(동대구우체국) → ordAddr2는 계약값 '없음'
 *
 * rec*에 센터+recAddr2='없음' 을 넣으면 ERR-311(recAddr2 없음) 반복 발생.
 * (modo shipments-book 과 동일: ord*=센터, rec*=고객)
 */

import type { InsertOrderParams } from './types';
import {
  normalizeEpostAddr1,
  normalizeEpostZip,
  requireEpostPhone,
  resolveEpostCenterAddr2,
  splitPickupAddressForEpost,
  truncateUtf8Bytes,
  EPOST_PICKUP_DETAIL_MIN_LEN,
} from './client';

/** 우체국 ordCompNm — 정확히 12byte (초과 시 ordMob 등 필드 밀림) */
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
  const pickupPhone = requireEpostPhone(input.pickup.phone, '수거 연락처(recTel)');
  const centerPhone = requireEpostPhone(input.center.phone, '센터 연락처(ordMob)');
  const pickupSplit = splitPickupAddressForEpost(input.pickup.addr1, input.pickup.addr2);

  if (pickupSplit.addr1.length < 2) {
    throw new Error('수거지 도로명 주소(recAddr1)가 없습니다.');
  }
  if (pickupSplit.addr2.length < EPOST_PICKUP_DETAIL_MIN_LEN) {
    throw new Error(
      '수거지 상세주소(recAddr2)가 없습니다. 동·호수·층을 2글자 이상 입력해주세요.',
    );
  }

  return {
    custNo: input.custNo,
    apprNo: input.apprNo,
    payType: '2',
    reqType: '2',
    officeSer: input.officeSer,
    orderNo: input.orderNo,
    ordCompNm: EPOST_ORD_COMP_NM,
    ordNm: truncateUtf8Bytes(EPOST_ORD_COMP_NM, 12),
    inqTelCn: pickupPhone,
    ordZip: normalizeEpostZip(input.center.zip),
    ordAddr1: normalizeEpostAddr1(input.center.addr1),
    ordAddr2: resolveEpostCenterAddr2(input.center.addr2),
    ordMob: centerPhone,
    recNm: truncateUtf8Bytes(input.pickup.name.trim() || '고객', 40),
    recZip: normalizeEpostZip(input.pickup.zip),
    recAddr1: pickupSplit.addr1,
    recAddr2: pickupSplit.addr2,
    recTel: pickupPhone,
    // recMob 미전송 — modo 반품소포와 동일. 포함 시 EPOST 파서 필드 밀림(ERR-311/522)
    contCd: '025',
    goodsNm: input.goodsNm,
    weight: input.weight,
    volume: input.volume,
    microYn: 'N',
    delivMsg: input.delivMsg,
    testYn: input.testYn,
    printYn: 'Y',
  };
}
