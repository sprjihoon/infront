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
const base = {
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  payType: '2', reqType: '2', officeSer: '260537802',
  ordCompNm: '인프론트', ordNm: '인프론트',
  ordZip: process.env.INFRONT_CENTER_ZIPCODE.replace(/\D/g, ''),
  ordAddr1: process.env.INFRONT_CENTER_ADDR1,
  ordAddr2: process.env.INFRONT_CENTER_ADDR2 || '없음',
  ordMob: p,
  recNm: '홍길동', recZip: '41142',
  recAddr1: '대구광역시 동구 동촌로 1', recAddr2: '상세주소 101호',
  recTel: '01012345678', recMob: '01012345678',
  contCd: '025', goodsNm: '수거테스트', printYn: 'Y', inqTelCn: '01012345678',
  testYn: 'N', microYn: 'N',
};

const combos = [[3,70],[3,80],[4,80],[5,70],[5,80],[5,90],[10,100],[10,80]];
let seq = 10;
for (const [w,v] of combos) {
  seq++;
  try {
    const r = await insertOrder({ ...base, weight:w, volume:v, orderNo: formatEpostOrderNo('SPB', seq) });
    console.log(`OK ${w}/${v} regiNo=${r.regiNo}`);
    await cancelOrder({ custNo: base.custNo, apprNo: base.apprNo, reqType:'2', payType:'2', reqNo:r.reqNo, resNo:r.resNo??'', regiNo:r.regiNo, reqYmd:new Date().toISOString().slice(0,10).replace(/-/g,''), delYn:'Y' });
  } catch (e) {
    console.log(`FAIL ${w}/${v}`, (e instanceof Error ? e.message : e).split(':').pop()?.trim());
  }
}
