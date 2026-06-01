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
const reqYmd = process.argv[5] || '20260527';
if (!regiNo || !reqNo || !resNo) {
  console.log('Usage: npx tsx scripts/probe-cancel2.mjs <regiNo> <reqNo> <resNo> [reqYmd]');
  process.exit(1);
}

const base = {
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  reqType: '2',
  payType: '2',
  reqNo,
  resNo,
  regiNo,
  reqYmd,
  delYn: 'Y',
};

const orders = [
  ['noPT_regiFirst', ['custNo', 'apprNo', 'reqType', 'regiNo', 'reqNo', 'resNo', 'reqYmd', 'delYn']],
  ['withPT_regiFirst', ['custNo', 'apprNo', 'payType', 'reqType', 'regiNo', 'reqNo', 'resNo', 'reqYmd', 'delYn']],
  ['noPT_manual', ['custNo', 'apprNo', 'reqType', 'reqNo', 'resNo', 'regiNo', 'reqYmd', 'delYn']],
  ['withPT_manual', ['custNo', 'apprNo', 'payType', 'reqType', 'reqNo', 'resNo', 'regiNo', 'reqYmd', 'delYn']],
  ['noPT_regi_res_req', ['custNo', 'apprNo', 'reqType', 'regiNo', 'resNo', 'reqNo', 'reqYmd', 'delYn']],
];

const apiKey = process.env.EPOST_API_KEY.trim();
const securityKey = process.env.EPOST_SECURITY_KEY.trim();

function pickCdata(txt, tag) {
  const c = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[(.*?)\\]\\]>\\s*</${tag}>`, 's').exec(txt);
  if (c) return c[1].trim();
  const p = new RegExp(`<${tag}>(.*?)</${tag}>`, 's').exec(txt);
  return p ? p[1].trim() : null;
}

for (const [label, keys] of orders) {
  const plain = keys.map((k) => `${k}=${base[k] ?? ''}`).join('&');
  const enc = seed128Encrypt(plain, securityKey);
  const url = `https://ship.epost.go.kr/api.GetResCancelCmd.jparcel?key=${apiKey}&regData=${encodeURIComponent(enc)}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Apache-HttpClient/4.5.1 (Java/1.8.0_91)' },
  });
  const txt = await resp.text();
  const code = pickCdata(txt, 'error_code');
  const canceled = pickCdata(txt, 'canceledYn') ?? pickCdata(txt, 'canceledyn');
  const msg = pickCdata(txt, 'message');
  console.log(`[${label}]`, code ?? 'OK', 'canceledYn=', canceled ?? '-', msg?.slice(0, 60) ?? '');
}
