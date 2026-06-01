import { readFileSync } from 'fs';
import { insertOrder, normalizeEpostPhone } from './lib/epost/client.ts';
import { resolvePickupBoxList, type PickupBoxSizeCode } from './lib/epost/pickup-boxes.ts';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const sizes: PickupBoxSizeCode[] = ['DEFAULT', 'SMALL', 'MEDIUM', 'LARGE', 'XL'];
const base = {
  custNo: process.env.EPOST_CUSTOMER_ID!.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO!.trim(),
  payType: '2' as const,
  reqType: '2' as const,
  officeSer: '260537802',
  ordCompNm: '인프론트',
  ordNm: '인프론트',
  ordZip: process.env.INFRONT_CENTER_ZIPCODE!.replace(/\D/g, ''),
  ordAddr1: process.env.INFRONT_CENTER_ADDR1!.trim(),
  ordAddr2: process.env.INFRONT_CENTER_ADDR2!.trim() || '없음',
  ordMob: normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE),
  recNm: '홍길동',
  recZip: '41142',
  recAddr1: '대구광역시 동구 동촌로 1',
  recAddr2: '101호',
  recTel: '01012345678',
  recMob: '01012345678',
  contCd: '025',
  goodsNm: '수거테스트',
  microYn: 'N' as const,
  printYn: 'Y' as const,
  inqTelCn: '01012345678',
  testYn: 'Y' as const,
};

for (const code of sizes) {
  const [spec] = resolvePickupBoxList({ box_size: code });
  try {
    const r = await insertOrder({
      ...base,
      weight: spec.weight,
      volume: spec.volume,
      orderNo: `SZ${code}${Date.now()}`.slice(0, 20),
    });
    console.log(`${code} ${spec.weight}/${spec.volume} OK price=${r.price} regiNo=${r.regiNo}`);
  } catch (e) {
    console.log(`${code} ${spec.weight}/${spec.volume} FAIL`, e instanceof Error ? e.message.split(':').slice(-1)[0].trim() : e);
  }
}
