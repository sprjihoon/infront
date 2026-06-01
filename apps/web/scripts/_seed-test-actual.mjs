// Test the ACTUAL seed128.ts (not the inline copy)
import { seed128Encrypt } from '../lib/epost/seed128.ts';

const key = '1234567890abcdefghijkl';
const plaintext = '123abc가나다';
const expected = '8522ad534acc61cb88090b7e62c5183b';

const result = seed128Encrypt(plaintext, key);
console.log('result  :', result);
console.log('expected:', expected);
console.log('PASS    :', result === expected);

// Test with production key and sample plaintext
const PROD_KEY = '6a19b1090142f7fd223445';
const PLAIN = 'custNo=0005085217&apprNo=7002080922&payType=2&reqType=2&officeSer=260537802&weight=2&volume=60&microYn=N&orderNo=TEST001&ordCompNm=인프론트&inqTelCn=01027239490&ordNm=인프론트&ordZip=41142&ordAddr1=대구광역시 동구 동촌로 1&ordAddr2=동대구우체국 2층 소포실&ordMob=01027239490&recNm=홍길동&recZip=41100&recAddr1=대구광역시 동구 범심로 188&recAddr2=201호&recTel=01027239490&contCd=025&goodsNm=수거테스트&retVisitYmd=20260602&printYn=Y';

const enc = seed128Encrypt(PLAIN, PROD_KEY);
console.log('\nProduction-like test:');
console.log('encLen:', enc.length, '(expected', Math.ceil(Buffer.byteLength(PLAIN,'utf8')/16)*32, ')');
console.log('enc prefix:', enc.slice(0,64));

// Check decryption manually by re-importing encrypt and using it for a known value
const PLAIN2 = 'recTel=01027239490&test=value';
const enc2 = seed128Encrypt(PLAIN2, PROD_KEY);
console.log('\nrecTel-only test:');
console.log('enc2:', enc2);
