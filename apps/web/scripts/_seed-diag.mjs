// Diagnose seed128.ts by checking key table values
// We know pure JS with SS1[109]=0x04000404 passes, seed128.ts fails
// Let's check what the actual tables in seed128.ts look like

// Directly call seed128Encrypt to test it
import { seed128Encrypt, buildEpostParams } from '../lib/epost/seed128.ts';

const key = '1234567890abcdefghijkl';
const plaintext = '123abc가나다';
const expected = '8522ad534acc61cb88090b7e62c5183b';

const actual = seed128Encrypt(plaintext, key);
console.log('seed128Encrypt result:', actual);
console.log('Expected:             ', expected);
console.log('PASS:', actual === expected);

// Now let's check the internal state by testing with a key that makes the first round key deterministic
// Test with all-zero key
const zeroKey = '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00';
// SEED with zero key: first block all zeros
// Known: SEED_ECB(key=0x00..., pt=0x00...) = 0x5EBAC6 ...
// Actually let me just check if the pure JS algorithm inline gives the same

// Pure JS algorithm (minimal, taken verbatim from _seed-test-pure.mjs)
// I'll just verify using hard-coded lookups
// SS1[109] should be 0x04000404 per the SEED standard
// seed128.ts has SS1[109]=? Let's extract by reversing:
// We can verify by checking what lookup result would be needed

// Actually, let's do a simpler check: use a 1-block plaintext and trace
// The first thing that matters is round key generation from the test key
// Let's just compare the actual encrypt output for the null key
const nullPt = '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00';
const nullKey = '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00extra';
// Known SEED test vector: key=00000000..., pt=00000000... should give specific output
// From SEED specification: key=0x00000000000000000000000000000000, pt=0x00000000000000000000000000000000
// Expected ct = 0x5EBAC6 ... (need to look up)

const nullResult = seed128Encrypt(nullPt, nullKey);
console.log('\nNull key+pt result:', nullResult);
// If SEED standard says something about this...

// Let's try: plaintext = ASCII "0123456789abcdef" (16 bytes exactly = 1 block)
// with key = "1234567890abcdef" (16 bytes)
const p1 = '0123456789abcdef';
const k1 = '1234567890abcdef'; 
const r1 = seed128Encrypt(p1, k1);
console.log('p1:', p1, '-> r1:', r1);

// Also test the PHP reference test vector from the manual
// From EPost manual: the reference output for "123abc가나다" should be 8522ad534acc61cb88090b7e62c5183b
// Let's check what byte index 109 the SS1 table lookup produces for specific input...
