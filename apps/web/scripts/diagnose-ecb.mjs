/**
 * ECB 독립성 진단: contCd를 바꿨을 때 다른 블록이 변하는지 확인
 * - 같은 블록만 변한다 → ECB 맞음, 서버 파싱 문제
 * - 다른 블록도 변한다 → SEED128 구현 버그
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

import { seed128Encrypt, buildEpostParams } from '../lib/epost/seed128.ts';

const custNo = process.env.EPOST_CUSTOMER_ID?.trim() ?? '';
const apprNo = process.env.EPOST_APPROVAL_NO?.trim() ?? '';
const secKey = process.env.EPOST_SECURITY_KEY?.trim() ?? '';

// ASCII-only 파라미터 (직전 테스트와 동일)
const BASE = {
  custNo, apprNo,
  payType: '2', reqType: '2',
  officeSer: '260537802',
  weight: 2, volume: 60, microYn: 'N',
  orderNo: 'DIAGFIXED001',
  ordCompNm: 'Infront',
  inqTelCn: '01027239490',
  ordNm: 'Infront',
  ordZip: '41142',
  ordAddr1: 'Daegu Donggu Dongchonro 1',
  ordAddr2: 'None',
  ordMob: '01027239490',
  recNm: 'Hong Gildong',
  recZip: '41100',
  recAddr1: 'Daegu Donggu Ansimro 188',
  recAddr2: '3F',
  recTel: '01027239490',
  contCd: '025',
  goodsNm: 'TestGoods',
  retVisitYmd: '20260604',
  printYn: 'Y',
};

function getHex(params) {
  const plainText = buildEpostParams(params, 'api.InsertOrder.jparcel');
  const hex = seed128Encrypt(plainText, secKey);
  return { plainText, hex };
}

const results = ['021', '024', '025'].map(cd => {
  const { plainText, hex } = getHex({ ...BASE, contCd: cd });
  return { cd, plainText, hex };
});

// 공통 plaintext 검증
const pt0 = results[0].plainText;
const pt1 = results[1].plainText;
const pt2 = results[2].plainText;

// contCd 위치 찾기
const contCdOffset = pt0.indexOf('&contCd=') + 8;
console.log(`contCd 위치: 바이트 ${Buffer.byteLength(pt0.slice(0, contCdOffset), 'utf8')}`);
console.log(`contCd 포함 블록: ${Math.floor(Buffer.byteLength(pt0.slice(0, contCdOffset), 'utf8') / 16)}`);
console.log(`total bytes: ${Buffer.byteLength(pt0, 'utf8')}`);
console.log('');

// 각 test의 plaintext가 contCd 부분만 다른지 확인
const pt0Buf = Buffer.from(pt0, 'utf8');
const pt1Buf = Buffer.from(pt1, 'utf8');
const pt2Buf = Buffer.from(pt2, 'utf8');

let diffCount01 = 0, diffCount02 = 0;
for (let i = 0; i < pt0Buf.length; i++) {
  if (pt0Buf[i] !== pt1Buf[i]) diffCount01++;
  if (pt0Buf[i] !== pt2Buf[i]) diffCount02++;
}
console.log(`plaintext 025 vs 024: ${diffCount01}개 바이트 다름 (1이어야 함)`);
console.log(`plaintext 025 vs 021: ${diffCount02}개 바이트 다름 (1이어야 함)`);
console.log('');

// 암호문 블록별 비교
const hex0 = results[0].hex; // contCd=025
const hex1 = results[1].hex; // contCd=024
const hex2 = results[2].hex; // contCd=021

const numBlocks = hex0.length / 32;
console.log(`블록 수: ${numBlocks}`);
console.log('');
console.log('블록별 차이 (025 vs 024 vs 021):');
let anyDiffOutsideContCd = false;
for (let b = 0; b < numBlocks; b++) {
  const s = b * 32, e = s + 32;
  const b0 = hex0.slice(s, e);
  const b1 = hex1.slice(s, e);
  const b2 = hex2.slice(s, e);
  const diff01 = b0 !== b1;
  const diff02 = b0 !== b2;
  if (diff01 || diff02) {
    // contCd 값이 있는 블록
    const byteStart = b * 16;
    const ptSlice = pt0.slice(
      Buffer.from(pt0.slice(0, byteStart)).length,
      Buffer.from(pt0.slice(0, byteStart + 16)).length
    );
    console.log(`  블록 ${String(b).padStart(2)}: 025=[${b0.slice(0,8)}..] 024=[${b1.slice(0,8)}..] 021=[${b2.slice(0,8)}..] ${diff01||diff02 ? '← DIFF' : ''}`);
    console.log(`    bytes ${byteStart}-${byteStart+15}: "${ptSlice.replace(/[\x00-\x1f]/g,'·')}"`);
    // contCd 블록은 예상됨
    const contCdBlock = Math.floor(Buffer.byteLength(pt0.slice(0, contCdOffset), 'utf8') / 16);
    if (b !== contCdBlock) {
      anyDiffOutsideContCd = true;
    }
  }
}
console.log('');
if (anyDiffOutsideContCd) {
  console.log('⚠️  SEED128이 ECB가 아님! contCd 블록 외에도 차이 발생 → 구현 버그');
} else {
  console.log('✅ ECB 확인: contCd 블록만 달라짐');
  console.log('→ SEED128 자체는 정상. 서버 파싱 문제로 보임.');
}
