/**
 * 우체국 신형 C형 송장. 용지는 글자가 가로가 되도록 171×111mm.
 * 칸 위치는 my-streamlit-app backend/app/services/epost/domestic_label.py 와 같다.
 * 한글은 그 파일이 쓰는 PyMuPDF korea 글꼴(Droid Sans Fallback)이다.
 */

import { readFileSync } from 'fs';
import path from 'path';
import bwipjs from 'bwip-js/node';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from 'pdf-lib';
import { lookupDeliveryCode } from './delivery-codes';

const PAGE_W = 484.72;
const PAGE_H = 314.65;

const ZIP_BAR = [18.0, 120.1, 103.2, 154.2] as const;
const TRACK_BAR = [172.1, 225.1, 319.6, 275.0] as const;
const SIDE_BAR = [426.1, 41.5, 435.1, 130.0] as const;
const QR = [133.3, 14.2, 156.0, 36.8] as const;

export interface DomesticLabelInput {
  print_sender_name?: string;
  print_sender_phone?: string;
  print_sender_zip?: string;
  print_sender_addr1?: string;
  print_sender_addr2?: string;
  recipient_name?: string;
  recipient_phone?: string;
  v_tel_no?: string;
  recipient_zip?: string;
  recipient_addr1?: string;
  recipient_addr2?: string;
  goods_name?: string;
  goods_qty?: number;
  order_no?: string;
  tracking_no?: string;
  post_office?: string;
  res_date?: string;
  created_at?: string;
  notes?: string;
  status?: string;
}

function digitsOf(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

function trackingText(value: unknown) {
  const digits = digitsOf(value);
  if (digits.length === 13) return `${digits.slice(0, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;
  return String(value ?? '').trim();
}

function phoneM(value: unknown) {
  const digits = digitsOf(value);
  if (digits.length === 11 && digits.startsWith('010')) {
    return `M: ${digits.slice(0, 3)}) ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length >= 9) return `M: ${digits}`;
  return '';
}

function phoneT(value: unknown) {
  const digits = digitsOf(value);
  if (digits.length === 11 && digits.startsWith('050')) {
    return `T: ${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 11) return `T: ${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 12) return `T: ${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (digits) return `T: ${digits}`;
  return '';
}

function phonePlain(value: unknown) {
  const shown = phoneT(value);
  return shown.startsWith('T: ') ? shown.slice(3) : shown;
}

function appliedDate(value: unknown) {
  const digits = digitsOf(value);
  if (digits.length >= 8) return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6, 8)}`;
  return '';
}

function fontFile() {
  const name = 'DroidSansFallback.ttf';
  const candidates = [
    path.join(process.cwd(), 'lib/epost', name),
    path.join(process.cwd(), 'apps/admin/lib/epost', name),
  ];
  for (const file of candidates) {
    try {
      return readFileSync(file);
    } catch {
      /* next */
    }
  }
  throw new Error('한글 폰트가 없습니다.');
}

async function code128Png(value: string) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: value,
    scale: 3,
    height: 12,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  });
}

async function qrPng(value: string) {
  return bwipjs.toBuffer({
    bcid: 'qrcode',
    text: value,
    scale: 4,
    backgroundcolor: 'FFFFFF',
  });
}

class Sheet {
  constructor(
    private page: PDFPage,
    private regular: PDFFont,
    private bold: PDFFont,
    private cjk: PDFFont,
  ) {}

  private face(text: string, font: 'korea' | 'hebo') {
    if (font === 'korea' || [...text].some((ch) => ch.charCodeAt(0) > 127)) return this.cjk;
    return font === 'hebo' ? this.bold : this.regular;
  }

  h(x: number, baseline: number, text: string, size: number, font: 'korea' | 'hebo' = 'korea') {
    if (!text) return x;
    const face = this.face(text, font);
    this.page.drawText(text, {
      x,
      y: PAGE_H - baseline,
      size,
      font: face,
      color: rgb(0, 0, 0),
    });
    return x + face.widthOfTextAtSize(text, size);
  }

  v(x: number, bottom: number, text: string, size: number, font: 'korea' | 'hebo' = 'korea') {
    if (!text) return;
    const face = this.face(text, font);
    this.page.drawText(text, {
      x,
      y: PAGE_H - bottom,
      size,
      font: face,
      color: rgb(0, 0, 0),
      rotate: degrees(90),
    });
  }

  async image(box: readonly [number, number, number, number], png: Buffer, turn: boolean) {
    const image = await this.page.doc.embedPng(png);
    const [x0, y0, x1, y1] = box;
    if (!turn) {
      this.page.drawImage(image, {
        x: x0,
        y: PAGE_H - y1,
        width: x1 - x0,
        height: y1 - y0,
      });
      return;
    }
    this.page.drawImage(image, {
      x: x1,
      y: PAGE_H - y1,
      width: y1 - y0,
      height: x1 - x0,
      rotate: degrees(90),
    });
  }
}

export async function renderDomesticLabelPdf(item: DomesticLabelInput): Promise<Uint8Array> {
  const senderName = String(item.print_sender_name ?? '');
  const senderPhone = String(item.print_sender_phone ?? '');
  const senderZip = digitsOf(item.print_sender_zip);
  const senderAddr1 = String(item.print_sender_addr1 ?? '');
  const senderAddr2 = String(item.print_sender_addr2 ?? '');
  const recName = String(item.recipient_name ?? '');
  const recPhone = String(item.v_tel_no || item.recipient_phone || '');
  const virtual = Boolean(digitsOf(item.v_tel_no));
  const recZip = digitsOf(item.recipient_zip);
  const recAddr1 = String(item.recipient_addr1 ?? '');
  const recAddr2 = String(item.recipient_addr2 ?? '');
  const goods = String(item.goods_name ?? '');
  const goodsQty = Math.max(1, Number(item.goods_qty) || 1);
  const orderNo = String(item.order_no ?? '');
  const tracking = trackingText(item.tracking_no);
  const trackingDigits = digitsOf(item.tracking_no);
  const office = String(item.post_office ?? '');
  const applied = appliedDate(item.res_date || item.created_at);
  const notes = String(item.notes ?? '');

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const cjk = await doc.embedFont(fontFile(), { subset: true });
  const sheet = new Sheet(
    page,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
    cjk,
  );

  if (item.status === 'canceled') {
    page.drawText('취소된 접수', {
      x: 2,
      y: PAGE_H - 28,
      size: 8,
      font: cjk,
      color: rgb(0.75, 0.05, 0.05),
    });
  }

  const code = lookupDeliveryCode(recZip);
  if (code) {
    sheet.h(173.51, 45.41, code.sort_code_1, 28, 'hebo');
    sheet.h(220.91, 33.21, '★', 20);
    sheet.h(214.07, 41.88, code.arr_cnpo_nm, 11);
    sheet.h(252.11, 45.41, code.sort_code_2, 28, 'hebo');
    sheet.h(307.07, 41.88, code.deliv_po_nm, 11);
    sheet.h(355.07, 36.17, `${code.sort_code_3} ${code.sort_code_4}`.trim(), 20, 'hebo');
    if (code.course_no) {
      sheet.h(325.55, 275.18, code.course_no, 23, 'hebo');
      sheet.h(375.83, 272.18, code.course_no, 12, 'hebo');
    }
  }

  sheet.h(2.15, 47.26, `접수국 : ${office}`.trim(), 6.96);
  sheet.h(2.15, 62.26, '주문인:', 6.96);
  sheet.h(33.11, 62.26, senderName, 6.96);
  sheet.h(2.15, 72.22, `고객 주문처: ${senderName}`, 6.96);
  const contact = sheet.h(2.15, 82.18, '문의처: ', 6.96);
  sheet.h(contact, 82.18, digitsOf(senderPhone), 6.96, 'hebo');
  const orderLabel = sheet.h(2.15, 91.18, '주문번호: ', 6.96);
  sheet.h(orderLabel, 91.18, orderNo, 6.96, 'hebo');
  sheet.h(103.31, 100.18, '요금: 계약요금', 6.96);
  sheet.h(87.71, 118.18, '신청일 :', 6.96);
  sheet.h(117.11, 118.18, applied, 6.96, 'hebo');
  sheet.h(138.71, 142.36, '(1/1)', 8.04, 'hebo');
  sheet.h(37.19, 168.95, recZip, 12, 'hebo');
  let goodsEnd = sheet.h(3.11, 187.36, `${goods},, 수량:${goodsQty}, `, 8.04);
  goodsEnd = sheet.h(goodsEnd, 187.36, orderNo, 8.04, 'hebo');
  sheet.h(goodsEnd, 187.36, '♠', 8.04);
  sheet.h(5.15, 293.26, notes, 6.96);

  sheet.h(185.15, 69.38, senderAddr1, 8.04);
  sheet.h(185.15, 77.42, senderAddr2, 8.04);
  sheet.h(363.23, 73.4, senderZip, 9.96, 'hebo');
  sheet.h(186.23, 96.65, senderName, 9);
  sheet.h(341.15, 97.18, phoneM(senderPhone), 6.96, 'hebo');
  sheet.h(189.11, 118.07, recAddr1, 7.8);
  sheet.h(189.11, 135.52, recAddr2, 11);
  sheet.h(186.23, 169.92, recName, 11);
  sheet.h(187.19, 187.61, phoneT(recPhone), 9, 'hebo');
  if (virtual) {
    sheet.h(187.07, 195.07, '※ 고객님의 개인정보 보호를 위하여 임시 가상번호를 사용합니다.', 6);
  }
  sheet.h(185.27, 210.32, '등기번호:', 9.96);
  sheet.h(231.23, 210.45, tracking, 14.04, 'hebo');

  sheet.v(433.83, 294.84, `${recAddr1} ${recAddr2}`.trim(), 6.96);
  sheet.v(444.75, 294.12, recName, 6.96);
  sheet.v(443.95, 238.2, phonePlain(recPhone), 6.96, 'hebo');
  sheet.v(448.42, 116.04, tracking, 7.93, 'hebo');
  sheet.v(456.75, 250.0, `${goods},,수량:${goodsQty},${orderNo}\u2660`, 5);
  sheet.v(457.83, 294.12, '내용품 :', 6.96);

  if (recZip) await sheet.image(ZIP_BAR, await code128Png(recZip), false);
  if (trackingDigits) {
    await sheet.image(QR, await qrPng(trackingDigits), false);
    await sheet.image(TRACK_BAR, await code128Png(trackingDigits), false);
    await sheet.image(SIDE_BAR, await code128Png(trackingDigits), true);
  }

  doc.setTitle(orderNo || tracking || '국내 송장');
  return doc.save();
}
