import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
console.log('INFRONT_CENTER_ADDR1:', JSON.stringify(process.env.INFRONT_CENTER_ADDR1));
console.log('INFRONT_CENTER_ADDR2:', JSON.stringify(process.env.INFRONT_CENTER_ADDR2 ?? '(not set)'));
console.log('INFRONT_CENTER_ZIPCODE:', JSON.stringify(process.env.INFRONT_CENTER_ZIPCODE));
console.log('ordAddr2 in live-specs:', JSON.stringify(process.env.INFRONT_CENTER_ADDR2 || '없음'));
