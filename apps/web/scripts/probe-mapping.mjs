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

function swapToInverted(p) {
  return {
    ...p,
    ordNm: pickup.name,
    ordZip: pickup.zip,
    ordAddr1: p.recAddr1,
    ordAddr2: p.recAddr2,
    ordMob: p.recTel,
    recNm: center.ordNm,
    recZip: center.zip,
    recAddr1: p.ordAddr1,
    recAddr2: '없음',
    recTel: p.ordMob,
    recMob: p.ordMob,
    inqTelCn: p.recTel,
  };
}

for (const name of ['modo-direct', 'inverted-swap']) {
  try {
    let params = buildReturnPickupOrderParams({
      ...base,
      orderNo: `DBG-${Date.now()}-${name}`,
      center,
      pickup,
    });
    if (name === 'inverted-swap') params = swapToInverted(params);
    const r = await insertOrder({ ...params, orderNo: `DBG-${Date.now()}-${name}2` });
    console.log(`[${name}] OK`, r.regiNo);
  } catch (e) {
    console.log(`[${name}] FAIL`, e instanceof Error ? e.message.split('\n')[0] : e);
  }
}
