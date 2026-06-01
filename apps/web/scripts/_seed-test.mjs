// EPost manual SEED128 verification test
// Key: "1234567890abcdefghijkl" (22 chars)
// Plaintext (UTF-8): "123abc가나다"
// Expected ciphertext (UTF-8): 8522ad534acc61cb88090b7e62c5183b
// Source: 우체국 계약소포 OpenAPI 매뉴얼 2023.12, p.2

import { seed128Encrypt } from '../lib/epost/seed128.ts';

const key = '1234567890abcdefghijkl';
const plaintext = '123abc가나다';
const expectedUtf8 = '8522ad534acc61cb88090b7e62c5183b';

const result = seed128Encrypt(plaintext, key);
console.log('result  :', result);
console.log('expected:', expectedUtf8);
console.log('match   :', result === expectedUtf8);

// Also test: plainLen vs plainTextBytes
const encoder = new TextEncoder();
const bytes = encoder.encode(plaintext);
console.log('plainLen (chars):', plaintext.length);
console.log('plainTextBytes (UTF-8):', bytes.length);
