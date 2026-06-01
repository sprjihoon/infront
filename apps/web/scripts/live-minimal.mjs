import { readFileSync } from 'fs';
import { insertOrder, cancelOrder, normalizeEpostPhone, formatEpostOrderNo } from '../lib/epost/client.ts';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const p = normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE);
const b = {
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  payType: '2',
  reqType: '2',
  officeSer: '260537802',
  ordCompNm: '인프론트',
  ordNm: '인프론트',
  ordZip: process.env.INFRONT_CENTER_ZIPCODE.replace(/\D/g, ''),
  ordAddr1: process.env.INFRONT_CENTER_ADDR1,
  ordAddr2: process.env.INFRONT_CENTER_ADDR2 || '없음',
  ordMob: p,
  recNm: '홍길동',
  recZip: '41142',
  recAddr1: '대구광역시 동구 동촌로 1',
  recAddr2: '상세주소 101호',
  recTel: '01012345678',
  recMob: '01012345678',
  contCd: '025',
  goodsNm: '물품',
  printYn: 'Y',
  inqTelCn: '01012345678',
  testYn: 'N',
  weight: 2,
  volume: 60,
  microYn: 'Y',
  orderNo: formatEpostOrderNo('SPB', 1),
};

try {
  const r = await insertOrder(b);
  console.log('OK', r.regiNo, r.price);
  await cancelOrder({
    custNo: b.custNo,
    apprNo: b.apprNo,
    reqType: '2',
    payType: '2',
    reqNo: r.reqNo,
    resNo: r.resNo ?? '',
    regiNo: r.regiNo,
    reqYmd: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    delYn: 'Y',
  });
  console.log('cancel ok');
} catch (e) {
  console.log('FAIL', e instanceof Error ? e.message : e);
}
