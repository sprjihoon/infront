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
if (!regiNo) { console.error('Usage: node _cancel-test.mjs <regiNo>'); process.exit(1); }

try {
  const r = await cancelOrder({
    custNo: process.env.EPOST_CUSTOMER_ID.trim(),
    apprNo: process.env.EPOST_APPROVAL_NO.trim(),
    regiNo,
    delYn: 'Y',
  });
  console.log('Cancelled:', JSON.stringify(r));
} catch (e) {
  console.log('Cancel error:', e instanceof Error ? e.message : e);
}
