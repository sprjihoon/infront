import { readFileSync } from 'fs';
import { seed128Encrypt } from '../lib/epost/seed128.ts';

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
if (!regiNo) {
  console.log('Usage: npx tsx scripts/probe-cancel3.mjs <regiNo> <reqNo> <resNo>');
  process.exit(1);
}

const apiKey = process.env.EPOST_API_KEY.trim();
const securityKey = process.env.EPOST_SECURITY_KEY.trim();

function pickCdata(txt, tag) {
  const c = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[(.*?)\\]\\]>\\s*</${tag}>`, 's').exec(txt);
  if (c) return c[1].trim();
  const p = new RegExp(`<${tag}>(.*?)</${tag}>`, 's').exec(txt);
  return p ? p[1].trim() : null;
}

async function tryPlain(label, plain) {
  const enc = seed128Encrypt(plain, securityKey);
  const url = `https://ship.epost.go.kr/api.GetResCancelCmd.jparcel?key=${apiKey}&regData=${encodeURIComponent(enc)}`;
  const txt = await (await fetch(url, {
    headers: { 'User-Agent': 'Apache-HttpClient/4.5.1 (Java/1.8.0_91)' },
  })).text();
  console.log(
    `[${label}]`,
    pickCdata(txt, 'error_code') ?? 'OK',
    'canceledYn=',
    pickCdata(txt, 'canceledYn') ?? pickCdata(txt, 'canceledyn') ?? '-',
    (pickCdata(txt, 'message') ?? '').slice(0, 55),
  );
}

const c = process.env.EPOST_CUSTOMER_ID.trim();
const a = process.env.EPOST_APPROVAL_NO.trim();
const ymds = ['20260527', '20260527231106', '20260528'];

for (const ymd of ymds) {
  await tryPlain(
    `ymd=${ymd} pt_regi`,
    `custNo=${c}&apprNo=${a}&payType=2&reqType=2&regiNo=${regiNo}&reqNo=${reqNo}&resNo=${resNo}&reqYmd=${ymd}&delYn=Y`,
  );
  await tryPlain(
    `ymd=${ymd} noPT_ids`,
    `custNo=${c}&apprNo=${a}&reqType=2&reqNo=${reqNo}&resNo=${resNo}&regiNo=${regiNo}&reqYmd=${ymd}&delYn=Y`,
  );
}
