import { readFileSync, writeFileSync } from 'fs';
import { insertOrder, cancelOrder, normalizeEpostPhone } from '../lib/epost/client.ts';

const raw = readFileSync('.env.local', 'utf8');
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const phone = normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE);
const LIVE = process.argv.includes('--live');
const testYn = LIVE ? 'N' : 'Y';

const base = {
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  payType: '2',
  reqType: '2',
  officeSer: '260537802',
  ordCompNm: process.env.INFRONT_CENTER_NAME,
  ordNm: process.env.INFRONT_CENTER_NAME,
  ordZip: process.env.INFRONT_CENTER_ZIPCODE.replace(/\D/g, ''),
  ordAddr1: process.env.INFRONT_CENTER_ADDR1,
  ordAddr2: process.env.INFRONT_CENTER_ADDR2?.trim() || '없음',
  ordMob: phone,
  recNm: '인프론트테스트',
  recZip: '41142',
  recAddr1: '대구광역시 동구 동촌로 1',
  recAddr2: '상세주소 101호',
  recTel: '01012345678',
  goodsNm: '수거테스트',
  printYn: 'Y',
  inqTelCn: '01012345678',
  testYn,
};

const specs = [
  { tag: 'MICRO', weight: 2, volume: 60, microYn: 'Y' },
  { tag: 'SMALL', weight: 5, volume: 80, microYn: 'N' },
];

const codes = [];
for (let i = 1; i <= 40; i++) codes.push(String(i).padStart(3, '0'));

const results = [];
let winner = null;

for (const spec of specs) {
  for (const contCd of codes) {
    try {
      const r = await insertOrder({
        ...base,
        ...spec,
        contCd,
        orderNo: `BR-${Date.now()}-${spec.tag}-${contCd}`,
      });
      const line = `${spec.tag} contCd=${contCd} OK regiNo=${r.regiNo}`;
      console.log(line);
      results.push(line);
      if (!winner) winner = { ...spec, contCd, result: r };
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('ERR-523')) continue;
      if (msg.includes('ERR-522') || msg.includes('ERR-311')) {
        // skip logging every failure
        continue;
      }
      console.log(`${spec.tag} contCd=${contCd}`, msg.slice(0, 80));
    }
  }
}

writeFileSync('scripts/brute-contcd-result.txt', results.join('\n') || 'none', 'utf8');

if (LIVE && winner) {
  const reqYmd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  await cancelOrder({
    custNo: base.custNo,
    apprNo: base.apprNo,
    reqType: '2',
    payType: '2',
    reqNo: winner.result.reqNo,
    resNo: winner.result.resNo ?? '',
    regiNo: winner.result.regiNo,
    reqYmd,
    delYn: 'Y',
  });
  console.log('cancelled', winner.result.regiNo);
}

if (winner) {
  console.log('WINNER', JSON.stringify({ contCd: winner.contCd, ...specs.find(s => s.tag === winner.tag) }));
} else {
  console.log('No valid contCd found in 001-040 for either spec');
}
