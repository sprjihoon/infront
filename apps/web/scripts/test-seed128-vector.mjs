/**
 * KISA SEED-128 표준 테스트 벡터 검증
 * RFC 4269 test vector:
 *   Key:        0x28DBC3BC 49FFD87D CFA509B1 1D422BE7
 *   Plaintext:  0xB41E6BE2 EBA84A14 8E2EED84 593C5EC7
 *   Ciphertext: 0x9B9B7BFC D1813CB9 5D0B3408 98F97BE7
 *
 * run: npx tsx scripts/test-seed128-vector.mjs
 */
import { seed128Encrypt } from '../lib/epost/seed128.ts';

// SEED-128 KISA 표준 테스트 벡터 1 (RFC 4269)
// Key: 28 DB C3 BC 49 FF D8 7D CF A5 09 B1 1D 42 2B E7
// PT:  B4 1E 6B E2 EB A8 4A 14 8E 2E ED 84 59 3C 5E C7
// CT:  9B 9B 7B FC D1 81 3C B9 5D 0B 34 08 98 F9 7B E7

// TextEncoder는 문자열을 UTF-8로 인코딩. 테스트 벡터는 raw bytes.
// seed128Encrypt는 내부적으로 TextEncoder를 사용하므로, key와 plaintext는
// Latin-1 (ISO-8859-1) 범위의 bytes를 1-byte chars로 전달해야 함.

function bytesToStr(bytes) {
  return bytes.map(b => String.fromCharCode(b)).join('');
}
function hexToBytes(hex) {
  const arr = [];
  for (let i = 0; i < hex.length; i += 2) arr.push(parseInt(hex.slice(i, i+2), 16));
  return arr;
}

const keyBytes   = hexToBytes('28DBC3BC49FFD87DCFA509B11D422BE7');
const ptBytes    = hexToBytes('B41E6BE2EBA84A148E2EED84593C5EC7');
const expected   = '9B9B7BFCD1813CB95D0B340898F97BE7'.toLowerCase();

// seed128Encrypt(plainText: string, key: string)
// → key의 bytes는 TextEncoder를 통해 UTF-8로 변환됨
// Latin-1 범위(0x00-0xFF) 문자면 UTF-8 = Latin-1 byte 그대로 사용됨
// (U+0080~U+00FF 범위는 UTF-8에서 2-byte 시퀀스로 인코딩됨!)

// 만약 key bytes에 0x80 이상이 있으면 UTF-8로 인코딩될 때 multi-byte가 됨
const keyHasHigh = keyBytes.some(b => b >= 0x80);
console.log('Key bytes (hex):', keyBytes.map(b => b.toString(16).padStart(2,'0')).join(' '));
console.log('Key has bytes >= 0x80:', keyHasHigh);
console.log('PT bytes (hex):', ptBytes.map(b => b.toString(16).padStart(2,'0')).join(' '));

if (keyHasHigh) {
  console.log('\n⚠️  key에 0x80 이상 바이트 있음!');
  console.log('TextEncoder는 0x80-0xFF를 2-byte UTF-8로 인코딩함');
  console.log('→ 실제 키 bytes가 달라져서 SEED128 결과가 표준과 다를 수 있음!');
  console.log('');
  console.log('TextEncoder가 실제로 사용하는 bytes:');
  const enc = new TextEncoder();
  const encoded = enc.encode(bytesToStr(keyBytes));
  console.log('  encoded len:', encoded.length, '(expected: 16)');
  console.log('  encoded bytes:', Array.from(encoded).map(b => b.toString(16).padStart(2,'0')).join(' '));
}

const keyStr = bytesToStr(keyBytes);
const ptStr  = bytesToStr(ptBytes);
const result = seed128Encrypt(ptStr, keyStr);

console.log('\n=== 테스트 결과 ===');
console.log('Expected:', expected);
console.log('Got:     ', result.toLowerCase());
console.log('Match:   ', result.toLowerCase() === expected ? '✅ 일치' : '❌ 불일치');

if (result.toLowerCase() !== expected) {
  console.log('\n→ SEED128 구현체에 버그 있음!');
  console.log('  TextEncoder가 0x80-0xFF 바이트를 2-byte UTF-8로 변환하는 것이 원인일 가능성 높음');
} else {
  console.log('\n→ SEED128 자체는 정확함. 다른 원인 탐색 필요.');
}

// 추가: 실제 EPOST_SECURITY_KEY로 간단한 테스트
console.log('\n=== 현재 키 바이트 분석 ===');
// epost security key: 6a19b1090142f7fd223445
const epostKey = process.env.EPOST_SECURITY_KEY?.replace(/[\r\n]/g, '') ?? '6a19b1090142f7fd223445';
const epostKeyBytes = new TextEncoder().encode(epostKey.substring(0, 16));
console.log('epost key (first 16 chars):', epostKey.substring(0, 16));
console.log('epost key bytes:', Array.from(epostKeyBytes).map(b => b.toString(16).padStart(2,'0')).join(' '));
console.log('all ASCII (<0x80):', epostKeyBytes.every(b => b < 0x80));
