import { readFileSync } from 'fs';
import { buildEpostParams } from '../lib/epost/seed128.ts';
import { insertOrder } from '../lib/epost/client.ts';

const raw = readFileSync('.env.local', 'utf8');
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  const key = t.slice(0, i).trim();
  let val = t.slice(i + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  process.env[key] = val;
}

const phone = (process.env.INFRONT_CENTER_PHONE ?? '').replace(/\D/g, '');
const params = {
  custNo: process.env.EPOST_CUSTOMER_ID?.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO?.trim(),
  payType: '2', reqType: '2', officeSer: '260537802',
  orderNo: `DBG-${Date.now()}`, weight: 2, volume: 60, microYn: 'Y',
  ordCompNm: process.env.INFRONT_CENTER_NAME,
  ordNm: process.env.INFRONT_CENTER_NAME,
  ordZip: process.env.INFRONT_CENTER_ZIPCODE?.replace(/\D/g, ''),
  ordAddr1: process.env.INFRONT_CENTER_ADDR1,
  ordAddr2: process.env.INFRONT_CENTER_ADDR2 || '없음',
  ordMob: phone,
  recNm: '인프론트테스트', recZip: '06236', recAddr1: '서울특별시 강남구 테헤란로 123',
  recAddr2: '테스트동 101호', recTel: '01012345678', contCd: '021', goodsNm: '수거테스트', printYn: 'Y', inqTelCn: '01012345678',
  testYn: 'Y',
};
console.log('ordMob', JSON.stringify(phone), 'len', phone.length, 'numeric', /^\d+$/.test(phone));
console.log('plain', buildEpostParams(params));
try {
  const r = await insertOrder(params);
  console.log('OK regiNo', r.regiNo);
} catch (e) {
  console.error('FAIL', e.message);
}
