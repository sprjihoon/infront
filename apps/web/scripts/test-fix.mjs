/**
 * 수정 후 검증 — route.ts addr2: center.addr2 적용 효과 확인
 * 프로덕션과 동일한 buildReturnPickupOrderParams 경로 사용
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(path.join(__dirname, '../.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

import { insertOrder, cancelOrder, normalizeEpostPhone, normalizeEpostAddr1, normalizeEpostZip, normalizeEpostPickupAddr2, requireEpostPhone, splitPickupAddressForEpost } from '../lib/epost/client.ts';
import { resolveInfrontCenterFromEnv } from '../lib/epost/center-config.ts';
import { buildReturnPickupOrderParams, } from '../lib/epost/pickup-order.ts';
import { formatEpostOrderNo } from '../lib/epost/client.ts';
import { normalizeEpostRetVisitYmd } from '../lib/epost/pickup-date.ts';

const center = resolveInfrontCenterFromEnv();
const custNo = process.env.EPOST_CUSTOMER_ID.trim();
const apprNo = process.env.EPOST_APPROVAL_NO.trim();

console.log('Center config:', {
  addr2: center.addr2,
  addr2Bytes: Buffer.byteLength(center.addr2, 'utf8'),
});

// 실제 사용자 주소 (스크린샷 기준)
const userAddr = '대구광역시 동구 안심로 188';
const userDetail = '제3층';
const userZip = '41100';
const userPhone = '01027239490';

const pickupSplit = splitPickupAddressForEpost(normalizeEpostAddr1(userAddr), userDetail);
const recAddr2ForEpost = normalizeEpostPickupAddr2(pickupSplit.addr2);

console.log('\nPickup address split:', {
  addr1: pickupSplit.addr1,
  addr2: pickupSplit.addr2,
  recAddr2ForEpost,
  recAddr2Bytes: Buffer.byteLength(recAddr2ForEpost, 'utf8'),
});

// route.ts 수정 후 실제 경로와 동일
const epostParams = buildReturnPickupOrderParams({
  custNo,
  apprNo,
  officeSer: '260537802',
  orderNo: formatEpostOrderNo('SPB', 1),
  center: {
    ordNm: center.ordNm,
    zip: center.zip,
    addr1: center.addr1,
    addr2: center.addr2,   // ← 수정됨: '' → center.addr2
    phone: center.phone || userPhone,
  },
  pickup: {
    name: '홍길동',
    zip: normalizeEpostZip(userZip),
    addr1: pickupSplit.addr1,
    addr2: recAddr2ForEpost,
    phone: requireEpostPhone(userPhone, 'recTel'),
  },
  goodsNm: '해외배송 물품',
  weight: 2,
  volume: 60,
  retVisitYmd: '20260604',
  testYn: 'Y',
});

console.log('\nEpost params:', {
  ordAddr2: epostParams.ordAddr2,
  ordAddr2Bytes: Buffer.byteLength(epostParams.ordAddr2 || '', 'utf8'),
  recZip: epostParams.recZip,
  recAddr1: epostParams.recAddr1,
  recAddr2: epostParams.recAddr2,
  recAddr2Bytes: Buffer.byteLength(epostParams.recAddr2 || '', 'utf8'),
  recTel: epostParams.recTel,
  retVisitYmd: epostParams.retVisitYmd,
});

try {
  const r = await insertOrder(epostParams);
  console.log('\n✅ SUCCESS! regiNo=', r.regiNo, 'price=', r.price);
  console.log('  (취소 시도...)');
  await cancelOrder({
    custNo, apprNo, reqType: '2', payType: '2',
    reqNo: r.reqNo, resNo: r.resNo ?? '', regiNo: r.regiNo,
    reqYmd: '20260528', delYn: 'Y',
  }).then(c => console.log('  cancel:', c.canceledYn))
    .catch(e => console.log('  cancel skip:', e.message?.slice(0, 50)));
} catch (e) {
  console.log('\n❌ FAIL:', e instanceof Error ? e.message.slice(0, 120) : e);
}
