/**
 * 우체국 EMS 접수 요청값.
 * 칸 나눔은 my-streamlit-app backend/app/services/ems/fields.py 와 같다.
 */

import hsTableJson from './epost_hs10.json';

const CALLING: Record<string, string> = {
  US: '1', CA: '1', JP: '81', CN: '86', HK: '852', TW: '886',
  GB: '44', DE: '49', FR: '33', AU: '61', SG: '65', TH: '66',
  VN: '84', MY: '60', PH: '63', ID: '62', NZ: '64', IT: '39',
  ES: '34', NL: '31', KR: '82',
};

const TRUNK_ZERO = new Set([
  'KR', 'JP', 'GB', 'DE', 'FR', 'AU', 'CN', 'IT', 'ES', 'NL',
  'TH', 'VN', 'MY', 'ID', 'NZ', 'TW',
]);

const FALLBACK_HS = '392690';

function digitsOf(value: string) {
  return value.replace(/\D/g, '');
}

function prefer(codes: string[]) {
  const tens = codes.filter((code) => code.length === 10 && /^\d+$/.test(code));
  for (const suffix of ['9000', '0000', '9090', '1000']) {
    const hits = tens.filter((code) => code.endsWith(suffix)).sort();
    if (hits.length) return hits[0];
  }
  return [...tens].sort()[0] ?? '';
}

const hsTable: Record<string, string[]> = {};
const knownHs = new Set<string>();
for (const [key, codes] of Object.entries(hsTableJson as Record<string, string[]>)) {
  const digits = digitsOf(key);
  const tens = codes.filter((code) => code.length === 10 && /^\d+$/.test(code));
  if (digits && tens.length) {
    hsTable[digits] = tens;
    tens.forEach((code) => knownHs.add(code));
  }
}

export function resolveEpostHs(code: string) {
  const digits = digitsOf(code);
  if (digits.length >= 10 && knownHs.has(digits.slice(0, 10))) return digits.slice(0, 10);
  const probe = digits.length >= 6 ? digits.slice(0, 6) : digits;
  if (hsTable[probe]) return prefer(hsTable[probe]);
  let bestKey = '';
  let best = 1;
  for (const key of Object.keys(hsTable)) {
    let matched = 0;
    const limit = Math.min(key.length, probe.length);
    for (let i = 0; i < limit; i += 1) {
      if (key[i] !== probe[i]) break;
      matched += 1;
    }
    if (matched > best || (matched === best && bestKey && key < bestKey)) {
      best = matched;
      bestKey = key;
    }
  }
  if (bestKey && best >= 2) return prefer(hsTable[bestKey]);
  return prefer(hsTable[FALLBACK_HS] ?? []);
}

export function hsCodeForEpost(code: string, document = false) {
  const parts: string[] = [];
  for (const piece of String(code || '').split(';')) {
    const digits = digitsOf(piece);
    if (!digits && !document) continue;
    let resolved = digits ? resolveEpostHs(digits) : '';
    if (document && (resolved.length !== 10 || !resolved.startsWith('49'))) resolved = '4901999000';
    if (resolved) parts.push(resolved);
  }
  return parts.join(';');
}

export function splitRecipientTel(phone: string, countrycd: string) {
  const digits = digitsOf(phone);
  const cc = CALLING[(countrycd || '').toUpperCase()] ?? '';
  let national = digits;
  if (cc && digits.startsWith(cc) && digits.length > cc.length + 4) national = digits.slice(cc.length);
  if (national.startsWith('0')) national = national.slice(1);
  return {
    receivetelno1: cc,
    receivetelno2: national.slice(0, 4),
    receivetelno3: national.slice(4, 8),
    receivetelno4: national.slice(8, 12),
  };
}

export function formatRecipientTel(phone: string, countrycd: string) {
  const parts = splitRecipientTel(phone, countrycd);
  let national = `${parts.receivetelno2}${parts.receivetelno3}${parts.receivetelno4}`;
  const country = (countrycd || '').toUpperCase();
  if (TRUNK_ZERO.has(country) && national && !national.startsWith('0')) national = `0${national}`;
  if (national.length === 11) return `${national.slice(0, 3)}-${national.slice(3, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
  if (national.length === 9) return `${national.slice(0, 2)}-${national.slice(2, 5)}-${national.slice(5)}`;
  return national;
}

export function senderMobileParts(tel1: string, tel2: string, tel3: string, tel4: string) {
  return {
    sendermobile1: digitsOf(tel1) || '82',
    sendermobile2: digitsOf(tel2),
    sendermobile3: digitsOf(tel3),
    sendermobile4: digitsOf(tel4),
  };
}

/** 우체국에 접수하는 운임 중량. 실중량과 부피중량 중 큰 값이다. */
export function chargeableWeightG(
  premiumcd: string,
  emEe: string,
  actualG: number,
  lengthCm: number,
  widthCm: number,
  heightCm: number,
) {
  const actual = Math.trunc(actualG || 0);
  if (emEe === 'ee' || !(lengthCm > 0 && widthCm > 0 && heightCm > 0)) return actual;
  const divisor = premiumcd === '32' ? 5 : 6;
  const volume = Math.ceil((lengthCm * widthCm * heightCm) / divisor);
  return Math.max(actual, volume);
}

/** 국내 소포 부피. 우체국 volume 은 가로+세로+높이(cm)다. */
export function domesticVolumeCm(length?: number, width?: number, height?: number) {
  if (!length || !width || !height) return 60;
  return Math.max(1, Math.round(length + width + height));
}
