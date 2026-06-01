import { readFileSync } from 'fs';
import { insertOrder, cancelOrder, normalizeEpostPhone } from '../lib/epost/client.ts';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const phone = normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE);
const base = {
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
  ordMob: phone,
  recNm: '홍길동',
  recZip: '41142',
  recAddr1: '대구광역시 동구 동촌로 1',
  recAddr2: '상세주소 101호',
  recTel: '01012345678',
  recMob: '01012345678',
  contCd: '025',
  goodsNm: '수거테스트',
  printYn: 'Y',
  inqTelCn: '01012345678',
  testYn: 'N',
  microYn: 'Y',
};

const combos = [
  [2, 60], [2, 80], [1, 60], [3, 60], [2, 100], [5, 80],
];

let winner = null;
for (const [weight, volume] of combos) {
  process.stdout.write(`${weight}kg/${volume}cm microY ... `);
  try {
    const r = await insertOrder({ ...base, weight, volume, orderNo: `M${Date.now()}${weight}${volume}` });
    console.log('OK', r.regiNo, r.price);
    winner = r;
    break;
  } catch (e) {
    console.log(e instanceof Error ? e.message.split(':').slice(-1)[0].trim() : e);
  }
}

if (winner) {
  const reqYmd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  await cancelOrder({
    custNo: base.custNo,
    apprNo: base.apprNo,
    reqType: '2',
    payType: '2',
    reqNo: winner.reqNo,
    resNo: winner.resNo ?? '',
    regiNo: winner.regiNo,
    reqYmd,
    delYn: 'Y',
  });
  console.log('cancelled', winner.regiNo);
}
