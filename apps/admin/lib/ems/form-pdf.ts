/**
 * 우체국 A4 양식에 접수 값을 덮어 쓴다.
 * EMS / EMS 프리미엄 / K-Packet 은 양식 파일이 서로 다르다.
 * 좌표는 my-streamlit-app backend/app/services/ems/form_pdf.py 와 같다.
 */

import { readFileSync } from 'fs';
import path from 'path';
import bwipjs from 'bwip-js/node';
import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import type { OfficialLabelData } from './label';

type Point = readonly [number, number];
type Box = readonly [number, number, number, number];

interface Layout {
  tracking: Point;
  weight: Point;
  volume: Point;
  zip: Point;
  dims: Point;
  countryBaseline: number;
  office: Point;
  signature: Point;
  feeRight: number;
  recipientWidth: number;
  recipientNextX: number | null;
  premiumWeights: boolean;
  nationalPhone: boolean;
}

const EMS_LAYOUT: Layout = {
  tracking: [123.72, 82.08],
  weight: [423.24, 320.76],
  volume: [423.24, 337.8],
  zip: [382.56, 303.84],
  dims: [501.84, 340.08],
  countryBaseline: 355.44,
  office: [491.76, 398.88],
  signature: [293.28, 429.12],
  feeRight: 544.0,
  recipientWidth: 230,
  recipientNextX: null,
  premiumWeights: false,
  nationalPhone: false,
};

const PREMIUM_LAYOUT: Layout = {
  tracking: [124.08, 82.08],
  weight: [420.36, 320.76],
  volume: [420.36, 337.8],
  zip: [373.56, 303.84],
  dims: [500.16, 340.08],
  countryBaseline: 357.84,
  office: [491.76, 393.72],
  signature: [297.12, 429.12],
  feeRight: 547.39,
  recipientWidth: 180,
  recipientNextX: 311.28,
  premiumWeights: true,
  nationalPhone: true,
};

const BARCODE: Box = [119.0, 93.0, 270.0, 130.0];
const COVERS: Box[] = [
  [120.0, 63.5, 280.0, 88.0],
  [310.0, 124.0, 340.0, 136.0],
  [346.0, 124.0, 370.0, 136.0],
  [376.0, 124.0, 398.0, 136.0],
  [404.0, 124.0, 436.0, 136.0],
  [486.0, 123.5, 545.0, 136.5],
  [89.0, 141.0, 275.0, 153.6],
  [344.0, 140.4, 550.0, 153.6],
  [92.0, 159.2, 275.0, 174.6],
  [348.0, 158.8, 552.0, 174.6],
  [56.0, 186.4, 278.0, 248.0],
  [314.0, 191.0, 555.0, 250.0],
  [348.0, 278.2, 552.0, 290.8],
  [116.0, 294.0, 192.0, 307.6],
  [374.0, 292.4, 424.0, 307.2],
  [464.0, 291.4, 555.0, 307.2],
  [414.0, 309.2, 468.0, 323.2],
  [414.0, 326.4, 468.0, 340.2],
  [508.0, 310.2, 544.5, 322.4],
  [498.0, 333.3, 550.0, 342.2],
  [519.0, 342.2, 541.0, 358.5],
  [545.0, 342.2, 566.0, 358.5],
  [250.0, 420.4, 360.0, 431.8],
  [478.0, 388.5, 560.0, 402.0],
  [28.4, 342.8, 166.4, 355.0],
  [168.2, 342.8, 196.6, 355.0],
  [198.2, 342.8, 238.2, 355.0],
  [240.0, 342.8, 279.8, 355.0],
  [281.4, 342.8, 321.6, 355.0],
  [323.2, 342.8, 363.4, 355.0],
  [28.4, 356.8, 166.4, 369.2],
  [168.2, 356.8, 196.6, 369.2],
  [198.2, 356.8, 238.2, 369.2],
  [240.0, 356.8, 279.8, 369.2],
  [281.4, 356.8, 321.6, 369.2],
  [323.2, 356.8, 363.4, 369.2],
  [28.4, 371.2, 166.4, 384.4],
  [168.2, 371.2, 196.6, 384.4],
  [198.2, 371.2, 238.2, 384.4],
  [240.0, 371.2, 279.8, 384.4],
  [281.4, 371.2, 321.6, 384.4],
  [323.2, 371.2, 363.4, 384.4],
];

const KPACKET_BARCODE: Box = [98.16, 149.04, 274.08, 174.0];
const KPACKET_BARCODE_BARS: Box = [111.25, 149.25, 260.5, 172.68];
const KPACKET_COVERS: Box[] = [
  [68.4, 337.7, 210.0, 347.4],
  [126.5, 347.5, 211.5, 360.2],
  [211.8, 347.5, 246.0, 360.2],
  [246.8, 347.5, 272.95, 360.2],
  [176.4, 361.0, 246.0, 374.2],
  [246.8, 361.0, 308.0, 374.2],
  [100.5, 368.15, 170.0, 376.9],
  [140.0, 173.6, 270.0, 185.5],
  [316.0, 196.4, 391.8, 214.8],
  [393.2, 196.4, 409.8, 214.8],
  [411.0, 196.4, 428.8, 214.8],
  [429.8, 196.4, 459.8, 214.8],
  [461.0, 196.4, 494.5, 214.8],
  [495.6, 196.4, 515.0, 214.8],
  [405.0, 296.0, 430.0, 307.5],
  [430.5, 296.0, 460.0, 308.2],
  [426.0, 364.2, 520.0, 373.5],
  [104.5, 193.2, 270.0, 205.2],
  [69.2, 204.0, 280.0, 225.5],
  [80.0, 250.3, 142.0, 262.2],
  [96.0, 264.5, 190.0, 276.4],
  [205.0, 264.5, 280.0, 276.4],
  [69.2, 279.2, 280.0, 292.4],
  [69.2, 293.3, 308.0, 316.6],
  [70.0, 326.6, 250.0, 338.6],
];
const KPACKET_PITCH = 19.8;
const ITEM_BASELINE = 351.24;
const ITEM_PITCH = 14.4;

const CALLING_CODES: Record<string, string> = {
  US: '1', CA: '1', JP: '81', CN: '86', HK: '852', TW: '886',
  GB: '44', DE: '49', FR: '33', AU: '61', SG: '65', TH: '66',
  VN: '84', MY: '60', PH: '63', ID: '62', NZ: '64', IT: '39',
  ES: '34', NL: '31', KR: '82',
};

const TRUNK_ZERO = new Set([
  'KR', 'JP', 'GB', 'DE', 'FR', 'AU', 'CN', 'IT', 'ES', 'NL',
  'TH', 'VN', 'MY', 'ID', 'NZ', 'TW',
]);

function readAsset(name: string): Buffer {
  const candidates = [
    path.join(process.cwd(), 'lib/ems/forms', name),
    path.join(process.cwd(), 'apps/admin/lib/ems/forms', name),
  ];
  for (const file of candidates) {
    try {
      return readFileSync(file);
    } catch {
      /* try the next root */
    }
  }
  throw new Error(`우체국 양식 파일이 없습니다: ${name}`);
}

function templateBytes(method: string): Buffer {
  if (method === 'KPACKET') return readAsset('kpacket_a4_v2p.pdf');
  if (method === 'EMS_PREMIUM') return readAsset('ems_nml_a4_v1p_p.pdf');
  return readAsset('ems_nml_a4_v1p.pdf');
}

class Sheet {
  constructor(
    private page: PDFPage,
    private regular: PDFFont,
    private bold: PDFFont,
    private cjk: PDFFont,
  ) {}

  private get height() {
    return this.page.getSize().height;
  }

  private face(text: string, font: 'helv' | 'hebi') {
    if ([...text].some((ch) => ch.charCodeAt(0) > 127)) return this.cjk;
    return font === 'hebi' ? this.bold : this.regular;
  }

  cover(box: Box) {
    const [x0, y0, x1, y1] = box;
    if (x1 <= x0 || y1 <= y0) return;
    this.page.drawRectangle({
      x: x0,
      y: this.height - y1,
      width: x1 - x0,
      height: y1 - y0,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });
  }

  at(
    point: Point,
    value: unknown,
    size: number,
    font: 'helv' | 'hebi' = 'helv',
    color: ReturnType<typeof rgb> = rgb(0, 0, 0),
  ) {
    const text = value == null ? '' : String(value);
    if (!text.trim()) return;
    this.page.drawText(text, {
      x: point[0],
      y: this.height - point[1],
      size,
      font: this.face(text, font),
      color,
    });
  }

  private widthOf(text: string, size: number, font: 'helv' | 'hebi') {
    return this.face(text, font).widthOfTextAtSize(text, size);
  }

  center(x0: number, x1: number, baseline: number, value: unknown, size: number, font: 'helv' | 'hebi' = 'helv') {
    const text = String(value ?? '').trim();
    if (!text) return;
    const width = this.widthOf(text, size, font);
    this.at([(x0 + x1 - width) / 2, baseline], text, size, font);
  }

  right(x1: number, baseline: number, value: unknown, size: number, font: 'helv' | 'hebi' = 'helv') {
    const text = String(value ?? '');
    if (!text.trim()) return;
    const width = this.widthOf(text, size, font);
    this.at([x1 - width, baseline], text, size, font);
  }

  lines(
    x: number,
    baseline: number,
    value: unknown,
    size: number,
    width: number,
    leading: number,
    font: 'helv' | 'hebi',
    nextX: number | null,
  ) {
    const text = String(value ?? '').split(/\s+/).filter(Boolean).join(' ');
    if (!text) return;
    const words = text.split(' ');
    const rows: string[] = [];
    let current = '';
    for (const word of words) {
      const trial = current ? `${current} ${word}` : word;
      if (this.widthOf(trial, size, font) <= width || !current) current = trial;
      else {
        rows.push(current);
        current = word;
      }
    }
    if (current) rows.push(current);
    const hang = nextX ?? x;
    rows.slice(0, 4).forEach((row, index) => {
      this.at([index === 0 ? x : hang, baseline + index * leading], row, size, font);
    });
  }

  async image(box: Box, png: Buffer, stretch: boolean) {
    const image = await this.page.doc.embedPng(png);
    const [x0, y0, x1, y1] = box;
    const boxW = x1 - x0;
    const boxH = y1 - y0;
    let w = boxW;
    let h = boxH;
    let x = x0;
    let top = y0;
    if (!stretch) {
      const scale = Math.min(boxW / image.width, boxH / image.height);
      w = image.width * scale;
      h = image.height * scale;
      x = x0 + (boxW - w) / 2;
      top = y0 + (boxH - h) / 2;
    }
    this.page.drawImage(image, {
      x,
      y: this.height - top - h,
      width: w,
      height: h,
    });
  }
}

function digitsOf(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

function two(value: unknown) {
  const text = String(value ?? '').trim();
  return text.length === 1 && /^\d$/.test(text) ? text.padStart(2, '0') : text;
}

function money(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function grams(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';
  return `${Math.trunc(number)} g`;
}

function spacedDigits(value: unknown) {
  return digitsOf(value).split('').join(' ');
}

function phone(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.includes('-')) {
    const parts = text.split('-').map((part) => part.trim().replace(/^\+/, '')).filter(Boolean);
    return ` ${parts.join('- ')}`;
  }
  const digits = digitsOf(text);
  const rest = digits.startsWith('82') && digits.length > 6 ? digits.slice(2) : '';
  if (rest && rest.length > 4) {
    return ` 82- ${rest.slice(0, 2)}- ${rest.slice(2, -4)}- ${rest.slice(-4)}`;
  }
  return ` ${text.replace(/^\+/, '')}`;
}

function formatRecipientTel(phoneNo: string, countrycd: string) {
  const digits = digitsOf(phoneNo);
  const country = countrycd.toUpperCase();
  const cc = CALLING_CODES[country] ?? '';
  let national = digits;
  if (cc && digits.startsWith(cc) && digits.length > cc.length + 4) {
    national = digits.slice(cc.length);
  }
  if (national.startsWith('0')) national = national.slice(1);
  if (TRUNK_ZERO.has(country) && national && !national.startsWith('0')) {
    national = `0${national}`;
  }
  if (national.length === 11) return `${national.slice(0, 3)}-${national.slice(3, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
  if (national.length === 9) return `${national.slice(0, 2)}-${national.slice(2, 5)}-${national.slice(5)}`;
  return national;
}

function recipientAddress(recipient: OfficialLabelData['recipient']) {
  return [recipient.addr3, recipient.addr2, recipient.addr1].map((part) => part.trim()).filter(Boolean).join(' ');
}

function dims(data: OfficialLabelData) {
  if (data.contents_type === 'document') return '';
  const { boxlength: length, boxwidth: width, boxheight: height } = data;
  if (!(length && width && height)) return '';
  return `${length} * ${width} * ${height}`;
}

function weightsForLayout(data: OfficialLabelData, layout: Layout) {
  const items = data.items.filter((item) => item.name_en).slice(0, 3).map((item) => ({ ...item }));
  if (!layout.premiumWeights || data.contents_type === 'document') {
    return { items, actual: data.totweight, volume: data.volume_weight };
  }
  const length = data.boxlength;
  const width = data.boxwidth;
  const height = data.boxheight;
  const raw = data.totweight || 0;
  let premiumVolume = Number(data.volume_weight) || 0;
  if (length && width && height && premiumVolume <= 0) {
    premiumVolume = Math.ceil((length * width * height) / 5);
  }
  const shownVolume = length && width && height
    ? Math.trunc((length * width * height) / 6)
    : premiumVolume;
  const shownActual = Math.max(raw, premiumVolume);
  if (items.length === 1) {
    const net = String(items[0].net_weight_g || '').trim();
    if (!net || net === String(raw)) items[0].net_weight_g = String(shownActual);
  }
  return { items, actual: shownActual, volume: shownVolume };
}

async function barcodePng(value: string) {
  const code = [...(value || 'NO-TRACKING')].filter((ch) => {
    const n = ch.charCodeAt(0);
    return n >= 32 && n < 127;
  }).join('') || 'NO-TRACKING';
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: code,
    scale: 4,
    height: 12,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  });
}

function fillEms(sheet: Sheet, data: OfficialLabelData, layout: Layout) {
  const sender = data.sender;
  const recipient = { ...data.recipient };
  if (layout.nationalPhone) {
    const shown = formatRecipientTel(recipient.phone, recipient.country);
    if (shown) recipient.phone = shown;
  }
  const { items, actual, volume } = weightsForLayout(data, layout);
  for (const box of COVERS) sheet.cover(box);
  sheet.cover(BARCODE);

  sheet.at(layout.tracking, data.regino, 17.99, 'hebi');
  sheet.center(308.6, 341.0, 132.84, data.posted_year, 6.96);
  sheet.center(341.0, 373.4, 132.84, two(data.posted_month), 6.96);
  sheet.center(373.4, 400.4, 132.84, two(data.posted_day), 6.96);
  const clock = data.posted_hour && data.posted_min
    ? `${two(data.posted_hour)}:${two(data.posted_min)}`
    : '';
  sheet.center(400.4, 438.2, 132.84, clock, 6.96);
  sheet.at([492.0, 133.32], data.post_office_code, 8.04);
  sheet.at([88.75, 151.32], phone(sender.tel), 9.96, 'hebi');
  sheet.at([343.27, 149.88], phone(recipient.phone), 9.96, 'hebi');
  sheet.at([93.0, 170.64], sender.name, 9.96, 'hebi');
  sheet.at([350.88, 170.28], recipient.name, 9.96, 'hebi');
  sheet.lines(61.68, 197.52, sender.address, 9.96, 210, 12.96, 'hebi', 56.76);
  sheet.lines(316.2, 202.92, recipientAddress(recipient), 9.96, layout.recipientWidth, 12.96, 'hebi', layout.recipientNextX);
  sheet.at([350.88, 287.76], recipient.email, 8.04, 'hebi');
  sheet.at([119.4, 305.28], spacedDigits(sender.zip), 9.96, 'hebi');
  sheet.at(layout.zip, recipient.zip, 9.96, 'hebi');
  const country = recipient.country_name.trim().toUpperCase();
  sheet.at([459.18, 302.76], country ? ` ${country}` : '', 9.96, 'hebi');
  sheet.at(layout.weight, grams(actual), 9.96, 'hebi');
  sheet.at(layout.volume, grams(volume), 9.96, 'hebi');
  if (data.ems_fee != null) {
    sheet.right(layout.feeRight, 319.68, `${data.ems_fee.toLocaleString('en-US')} `, 8.04);
  }
  sheet.at(layout.dims, dims(data), 6.0);
  const code = recipient.country.toUpperCase();
  sheet.center(517.3, 542.8, layout.countryBaseline, code.slice(0, 1), 12.96, 'hebi');
  sheet.center(542.8, 567.7, layout.countryBaseline, code.slice(1, 2), 12.96, 'hebi');
  sheet.at(layout.signature, sender.name, 6.96);
  sheet.at(layout.office, data.post_office, 8.04);

  items.forEach((item, index) => {
    const baseline = ITEM_BASELINE + index * ITEM_PITCH;
    const price = item.name_en ? money(item.unit_price_usd * (item.quantity || 1)) : '';
    sheet.at([29.4, baseline], item.name_en, 6.96);
    sheet.center(167.5, 197.4, baseline, item.quantity, 6.96);
    sheet.center(197.4, 239.0, baseline, item.net_weight_g, 6.96);
    sheet.center(239.0, 280.8, baseline, price, 6.96);
    sheet.at([284.28, baseline], item.print_hs, 6.0);
    sheet.center(322.4, 364.2, baseline, item.origin_country, 6.96);
  });
  if (data.status === 'canceled') {
    sheet.at([40, 22], '취소된 접수', 11, 'hebi', rgb(0.75, 0.05, 0.05));
  }
}

function kpacketVolume(data: OfficialLabelData) {
  const { boxlength: length, boxwidth: width, boxheight: height } = data;
  if (length && width && height) return Math.trunc((length * width * height) / 6);
  const volume = Number(data.volume_weight);
  return Number.isFinite(volume) ? Math.trunc(volume) : 0;
}

function kpacketDate(data: OfficialLabelData) {
  if (!(data.posted_year && data.posted_month && data.posted_day)) return '';
  return `${data.posted_year}.${two(data.posted_month)}.${two(data.posted_day)}.actual`;
}

function kpacketSenderTel(value: string) {
  const digits = digitsOf(value);
  if (digits.startsWith('82') && digits.length > 6) {
    const rest = digits.slice(2);
    if (rest.length > 4) return `Tel: 82- ${rest.slice(0, 2)}- ${rest.slice(2, -4)}- ${rest.slice(-4)}`;
  }
  const text = value.trim();
  return text ? `Tel: ${text}` : '';
}

function kpacketRecipientTel(phoneNo: string, country: string) {
  const shown = formatRecipientTel(phoneNo, country);
  return shown ? `Tel: ${shown.replace(/-/g, '- ')}` : '';
}

function fillKpacket(sheet: Sheet, data: OfficialLabelData) {
  const sender = data.sender;
  const recipient = data.recipient;
  const items = data.items.filter((item) => item.name_en).slice(0, 5);
  for (const box of KPACKET_COVERS) sheet.cover(box);
  sheet.cover(KPACKET_BARCODE);

  if (data.order_no.trim()) sheet.at([68.64, 345.36], `OrderNo. ${data.order_no.trim()}`, 6.96, 'hebi');
  const posted = kpacketDate(data);
  if (posted) sheet.at([127.44, 357.12], posted, 9.0, 'hebi');
  if (data.totweight > 0) sheet.at([212.52, 357.12], `${data.totweight}g`, 9.0, 'hebi');
  if (data.ems_fee != null) sheet.at([247.08, 357.12], String(data.ems_fee), 9.0, 'hebi');
  const volume = kpacketVolume(data);
  if (volume > 0) sheet.at([176.76, 370.92], `volume ${volume}g`, 9.0, 'hebi');
  sheet.at([247.08, 370.92], 'Country :    ', 9.0, 'hebi');
  sheet.at([287.28, 370.92], recipient.country.toUpperCase(), 9.0, 'hebi');
  sheet.at([100.92, 374.28], dims(data), 6.96, 'hebi');
  sheet.at([158.28, 182.4], data.regino, 8.04, 'hebi');

  let total = 0;
  items.forEach((item, index) => {
    const shift = index * KPACKET_PITCH;
    const qty = item.quantity || 1;
    const unit = item.unit_price_usd || 0;
    total += unit * qty;
    sheet.at([316.2, 208.56 + shift], item.name_en, 8.04, 'hebi');
    sheet.at([399.84, 208.56 + shift], qty, 8.04, 'hebi');
    sheet.at([413.88, 208.08 + shift], item.net_weight_g, 6.0, 'hebi');
    sheet.at([441.12, 208.56 + shift], money(unit * qty), 8.04, 'hebi');
    sheet.at([464.04, 207.6 + shift], item.print_hs, 5.04, 'hebi');
    sheet.at([500.4, 208.56 + shift], item.origin_country, 8.04, 'hebi');
  });
  if (data.totweight > 0) sheet.at([413.64, 304.68], data.totweight, 6.0, 'hebi');
  if (items.length) sheet.at([440.88, 305.16], money(total), 8.04, 'hebi');
  sheet.at([432.36, 371.04], sender.name, 6.0, 'hebi');
  sheet.at([105.6, 202.08], kpacketSenderTel(sender.tel), 8.04, 'hebi');
  sheet.at([69.6, 212.04], sender.name, 8.04, 'hebi');
  sheet.at([69.6, 221.76], sender.address, 8.04, 'hebi');
  sheet.at([86.76, 259.32], spacedDigits(sender.zip), 8.04, 'hebi');
  sheet.at([97.2, 273.48], kpacketRecipientTel(recipient.phone, recipient.country), 8.04, 'hebi');
  if (recipient.zip.trim()) sheet.at([210.96, 273.48], `ZIP: ${recipient.zip.trim()}`, 8.04, 'hebi');
  sheet.at([69.6, 289.32], recipient.name, 9.0, 'hebi');
  const street = [recipient.addr3, recipient.addr2].map((part) => part.trim()).filter(Boolean).join(' ');
  sheet.at([69.6, 303.24], street, 9.0, 'hebi');
  sheet.at([69.6, 313.32], recipient.addr1, 9.0, 'hebi');
  sheet.at([74.64, 335.64], recipient.country_name.trim().toUpperCase(), 8.04, 'hebi');
  if (data.status === 'canceled') {
    sheet.at([40, 22], '취소된 접수', 11, 'hebi', rgb(0.75, 0.05, 0.05));
  }
}

export async function renderLabelPdf(data: OfficialLabelData): Promise<Uint8Array> {
  const method = data.shipping_method || 'EMS';
  const doc = await PDFDocument.load(templateBytes(method));
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // NanumGothic-Regular.ttf — SIL Open Font License
  const cjk = await doc.embedFont(readAsset('NanumGothic-Regular.ttf'), { subset: true });
  const barcode = await barcodePng(data.regino);
  const layout = method === 'EMS_PREMIUM' ? PREMIUM_LAYOUT : EMS_LAYOUT;

  for (const page of doc.getPages()) {
    const sheet = new Sheet(page, regular, bold, cjk);
    if (method === 'KPACKET') fillKpacket(sheet, data);
    else fillEms(sheet, data, layout);
    await sheet.image(
      method === 'KPACKET' ? KPACKET_BARCODE_BARS : BARCODE,
      barcode,
      method === 'KPACKET',
    );
  }

  doc.setTitle(`${data.order_no || data.regino} ${method}`);
  return doc.save();
}
