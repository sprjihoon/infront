import { readFileSync } from 'fs';
import { insertOrder, cancelOrder, normalizeEpostPhone, formatEpostOrderNo } from '../lib/epost/client.ts';

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
  microYn: 'N',
};

const weights = [1, 2, 3, 4, 5];
const volumes = [60, 70, 80, 90, 100];

let seq = 0;
for (const weight of weights) {
  for (const volume of volumes) {
    seq += 1;
    try {
      const r = await insertOrder({
        ...base,
        weight,
        volume,
        microYn: 'N',
        orderNo: formatEpostOrderNo('SPB', seq),
      });
      console.log(`OK ${weight}kg/${volume}cm regiNo=${r.regiNo}`);
      await cancelOrder({
        custNo: base.custNo,
        apprNo: base.apprNo,
        reqType: '2',
        payType: '2',
        reqNo: r.reqNo,
        resNo: r.resNo ?? '',
        regiNo: r.regiNo,
        reqYmd: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        delYn: 'Y',
      });
      process.exit(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const short = msg.includes('ERR-') ? msg.match(/ERR-\d+[^:]*:?\s*(.*)/)?.[0]?.slice(0, 60) : msg.slice(0, 60);
      process.stdout.write(`${weight}/${volume}:${short?.split(':').pop()?.trim() ?? 'err'} | `);
    }
  }
  console.log('');
}
