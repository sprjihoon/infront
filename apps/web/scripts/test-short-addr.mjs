/**
 * ordAddr1을 짧게 해서 recZip 위치를 296byte 이내로 줄이는 테스트
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

function makeParams(ordAddr1, label) {
  return {
    custNo, apprNo,
    payType: '2', reqType: '2',
    officeSer: '260537802',
    ordCompNm: '인프론트',  // Korean (12 UTF-8 bytes)
    ordNm: '인프론트',
    inqTelCn: p,
    ordZip: '41142',
    ordAddr1,                // Variable
    ordAddr2: '없음',        // 없음 = 6 bytes (short)
    ordMob: p,
    recNm: '홍길동',         // Korean (9 bytes)
    recZip: '41100',
    recAddr1: '대구광역시 동구 안심로 188',
    recAddr2: '제3층',
    recTel: p,
    contCd: '025',
    goodsNm: '수거테스트',
    weight: 2, volume: 15000, microYn: 'N',
    retVisitYmd: '20260604',
    printYn: 'Y',
    orderNo: `SA${Date.now()}${label}`,
    testYn: 'Y',
  };
}

const variants = [
  // 한글 전체 (현재 상황): 34 bytes
  { label: 'A', ordAddr1: '대구광역시 동구 동촌로 1' },
  // 짧게 - 구 이름 없음: 26 bytes  
  { label: 'B', ordAddr1: '대구광역시 동촌로 1' },
  // 더 짧게: '동촌로 1' = 12 bytes
  { label: 'C', ordAddr1: '동촌로 1' },
  // ASCII: 'Dongchon-ro 1' = 13 bytes
  { label: 'D', ordAddr1: 'Dongchon-ro 1' },
];

for (const v of variants) {
  // 바이트 위치 계산
  const pre = [
    `custNo=${custNo}`,     // 18
    `&apprNo=${apprNo}`,   // 19
    `&payType=2`,          // 10
    `&reqType=2`,          // 10
    `&officeSer=260537802`, // 20
    `&weight=2`,           // 9
    `&volume=15000`,       // 14
    `&microYn=N`,          // 10
    `&orderNo=SA${Date.now()}${v.label}`, // 9+~15
    `&ordCompNm=인프론트`,   // 11+12=23
    `&inqTelCn=${p}`,      // 21
    `&ordNm=인프론트`,      // 8+12=20
    `&ordZip=41142`,       // 13
    `&ordAddr1=${v.ordAddr1}`, // 10+len
    `&ordAddr2=없음`,      // 10+6=16
    `&ordMob=${p}`,        // 20
    `&recNm=홍길동`,        // 7+9=16
  ].join('');
  
  const textEncoder = new TextEncoder();
  const preBytes = textEncoder.encode(pre).length;
  
  console.log(`\n[${v.label}] ordAddr1="${v.ordAddr1}" (${textEncoder.encode(v.ordAddr1).length} bytes)`);
  console.log(`  recZip starts at byte ~${preBytes} (value at ~${preBytes+8})`);
  
  try {
    await insertOrder(makeParams(v.ordAddr1, v.label));
    console.log(`  ✅ 성공!`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const m = msg.match(/ERR-\d+.*?(?=\.\s|$)/)?.[0] || msg.slice(0,80);
    console.log(`  ❌ ${m}`);
  }
}
