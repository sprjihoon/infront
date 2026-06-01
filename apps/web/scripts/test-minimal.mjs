/**
 * 극도로 짧은 ord* 값으로 rec* 필드를 최대한 앞으로 당겨서 테스트
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
const { insertOrder, normalizeEpostPhone } = await import('../lib/epost/client.ts');
const custNo = process.env.EPOST_CUSTOMER_ID?.trim() ?? '';
const apprNo = process.env.EPOST_APPROVAL_NO?.trim() ?? '';
const p = normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE);

// 극단적으로 짧게: ord*는 최소값, rec*는 실제 주소
const params = {
  custNo, apprNo,
  payType: '2', reqType: '2',
  officeSer: '260537802',
  ordCompNm: 'I',     // 1 byte
  ordNm: 'I',         // 1 byte
  inqTelCn: p,
  ordZip: '41142',
  ordAddr1: 'A',      // 1 byte
  ordAddr2: 'A',      // 1 byte
  ordMob: p,
  recNm: '홍길동',
  recZip: '41100',
  recAddr1: '대구광역시 동구 안심로 188',
  recAddr2: '제3층',
  recTel: p,
  contCd: '025',
  goodsNm: '수거테스트',
  weight: 2, volume: 15000, microYn: 'N',
  retVisitYmd: '20260604',
  printYn: 'Y',
  orderNo: `MIN${Date.now()}`,
  testYn: 'Y',
};

const enc = new TextEncoder();
const pre = [
  `custNo=${custNo}`, `&apprNo=${apprNo}`,
  `&payType=2`, `&reqType=2`,
  `&officeSer=260537802`, `&weight=2`, `&volume=15000`, `&microYn=N`,
  `&orderNo=${params.orderNo}`,
  `&ordCompNm=I`, `&inqTelCn=${p}`,
  `&ordNm=I`, `&ordZip=41142`,
  `&ordAddr1=A`, `&ordAddr2=A`,
  `&ordMob=${p}`,
  `&recNm=홍길동`,
].join('');

const preBytes = enc.encode(pre).length;
console.log(`recZip starts at byte ~${preBytes} (value at ~${preBytes+8})`);

try {
  const r = await insertOrder(params);
  console.log('✅ 성공!', r);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/ERR-\d+[^.]*\./)?.[0] || msg.slice(0,120);
  console.log('❌', m);
}
