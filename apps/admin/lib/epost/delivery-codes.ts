/**
 * 우편번호별 집배코드.
 * my-streamlit-app backend/app/services/epost/delivery_codes.csv 와 같은 표다.
 */

import { readFileSync } from 'fs';
import path from 'path';

export interface DeliveryCode {
  zipcode: string;
  sort_code_1: string;
  sort_code_2: string;
  sort_code_3: string;
  sort_code_4: string;
  arr_cnpo_nm: string;
  deliv_po_nm: string;
  course_no: string;
}

let table: Map<string, DeliveryCode> | null = null;

function csvPath() {
  const name = 'delivery_codes.csv';
  const candidates = [
    path.join(process.cwd(), 'lib/epost', name),
    path.join(process.cwd(), 'apps/admin/lib/epost', name),
  ];
  for (const file of candidates) {
    try {
      readFileSync(file);
      return file;
    } catch {
      /* next */
    }
  }
  throw new Error('집배코드 표가 없습니다.');
}

function loadTable() {
  if (table) return table;
  const text = readFileSync(csvPath(), 'utf8').replace(/^\uFEFF/, '');
  const [headerLine, ...rows] = text.split(/\r?\n/);
  const header = headerLine.split(',').map((cell) => cell.trim());
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  const next = new Map<string, DeliveryCode>();
  for (const line of rows) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    const zipcode = (cols[index.zipcode] ?? '').trim();
    if (zipcode.length !== 5) continue;
    const cell = (name: string) => (cols[index[name]] ?? '').trim();
    next.set(zipcode, {
      zipcode,
      sort_code_1: cell('sort_code_1'),
      sort_code_2: cell('sort_code_2'),
      sort_code_3: cell('sort_code_3'),
      sort_code_4: cell('sort_code_4'),
      arr_cnpo_nm: cell('arr_cnpo_nm'),
      deliv_po_nm: cell('deliv_po_nm'),
      course_no: cell('course_no'),
    });
  }
  table = next;
  return next;
}

export function lookupDeliveryCode(zipcode: string): DeliveryCode | null {
  const digits = zipcode.replace(/\D/g, '');
  if (digits.length !== 5) return null;
  return loadTable().get(digits) ?? null;
}
