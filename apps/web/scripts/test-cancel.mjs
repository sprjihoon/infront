import { readFileSync } from 'fs';
import { cancelOrder } from '../lib/epost/client.ts';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const regiNo = process.argv[2];
const reqNo = process.argv[3];
const resNo = process.argv[4];
if (!regiNo || !reqNo || !resNo) {
  console.log('Usage: npx tsx scripts/test-cancel.mjs <regiNo> <reqNo> <resNo>');
  process.exit(1);
}

const reqYmd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
try {
  const r = await cancelOrder({
    custNo: process.env.EPOST_CUSTOMER_ID.trim(),
    apprNo: process.env.EPOST_APPROVAL_NO.trim(),
    reqType: '2',
    payType: '2',
    reqNo,
    resNo,
    regiNo,
    reqYmd,
    delYn: 'Y',
  });
  console.log('OK', r);
} catch (e) {
  console.log('FAIL', e instanceof Error ? e.message : e);
}
