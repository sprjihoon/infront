import { readFileSync } from 'fs';
import { insertOrder } from '../lib/epost/client.ts';
import { buildReturnPickupOrderParams } from '../lib/epost/pickup-order.ts';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const center = {
  ordNm: '인프론트',
  zip: process.env.INFRONT_CENTER_ZIPCODE.replace(/\D/g, ''),
  addr1: process.env.INFRONT_CENTER_ADDR1,
  addr2: '',
  phone: process.env.INFRONT_CENTER_PHONE,
};
const pickup = {
  name: '홍길동',
  zip: '41100',
  addr1: '대구광역시 동구 범심로 188',
  addr2: '201호',
  phone: '01012345678',
};
const base = {
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  officeSer: '260537802',
  goodsNm: '수거테스트',
  weight: 2,
  volume: 60,
  testYn: 'N',
};

const variants = [
  { label: 'modo+noRecMob', patch: (p) => { delete p.recMob; return p; } },
  { label: 'modo+noInq', patch: (p) => { delete p.inqTelCn; return p; } },
  { label: 'modo+ordTel=center', patch: (p) => ({ ...p, ordTel: p.ordMob }) },
  { label: 'modo+longOrdAddr2', patch: (p) => ({ ...p, ordAddr2: process.env.INFRONT_CENTER_ADDR2 || '동대구우체국 2층' }) },
];

for (const v of variants) {
  try {
    let params = buildReturnPickupOrderParams({
      ...base,
      orderNo: `MX${Date.now()}${Math.floor(Math.random() * 99)}`,
      center,
      pickup,
    });
    params = v.patch(params);
    const r = await insertOrder(params);
    console.log(`[${v.label}] OK regiNo=${r.regiNo}`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.log(`[${v.label}] FAIL`, m.split('\n')[0].slice(0, 120));
  }
}
