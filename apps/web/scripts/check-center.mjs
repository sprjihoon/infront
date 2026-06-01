import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(path.join(__dirname, '../.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const { resolveInfrontCenterFromEnv } = await import('../lib/epost/center-config.ts');
const c = resolveInfrontCenterFromEnv();
console.log('Center config:', JSON.stringify(c, null, 2));

// EUC-KR bytes for center addr1 and addr2
import iconv from 'iconv-lite';
console.log('ordAddr1 EUC-KR bytes:', iconv.encode(c.addr1, 'EUC-KR').length, '→', c.addr1);
console.log('ordAddr2 EUC-KR bytes:', iconv.encode(c.addr2, 'EUC-KR').length, '→', c.addr2);
