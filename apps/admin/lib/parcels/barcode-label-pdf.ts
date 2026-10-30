/**
 * 입고 바코드 라벨.
 * 한 페이지가 스티커 한 장(62×38mm)이다. A4에 모아 찍지 않는다.
 * 칸 배치는 modo 입고 바코드 라벨과 같다.
 */

import { readFileSync } from 'fs';
import path from 'path';
import bwipjs from 'bwip-js/node';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

const MM = 72 / 25.4;
const LABEL_W = 62 * MM;
const LABEL_H = 38 * MM;

export interface InboundBarcodeLabel {
  barcode: string;
  product: string;
  option?: string;
  vendor: string;
}

function fontFile() {
  const name = 'NanumGothic-Regular.ttf';
  const candidates = [
    path.join(process.cwd(), 'lib/ems/forms', name),
    path.join(process.cwd(), 'apps/admin/lib/ems/forms', name),
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

function clip(value: string, max: number) {
  return [...value].slice(0, max).join('');
}

async function code128(text: string) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 2,
    height: 12,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  });
}

function center(page: PDFPage, font: PDFFont, text: string, centerX: number, baseline: number, size: number, color = rgb(0, 0, 0)) {
  if (!text) return;
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - width / 2, y: baseline, size, font, color });
}

export async function renderInboundBarcodePdf(labels: InboundBarcodeLabel[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontFile(), { subset: true });
  const pages = labels.length > 0 ? labels : [{ barcode: '', product: '', vendor: '' }];

  for (const label of pages) {
    const page = doc.addPage([LABEL_W, LABEL_H]);
    if (label.barcode) {
      const png = await code128(label.barcode);
      const image = await doc.embedPng(png);
      const barH = 12 * MM;
      const maxW = LABEL_W - 4 * MM;
      const naturalW = (image.width / image.height) * barH;
      const barW = Math.min(maxW, naturalW);
      const barX = (LABEL_W - barW) / 2;
      const barY = LABEL_H - 14 * MM;
      page.drawImage(image, { x: barX, y: barY, width: barW, height: barH });
      center(page, font, label.barcode, LABEL_W / 2, LABEL_H - 15.5 * MM, 7);
    }

    center(page, font, clip(label.product, 20), LABEL_W / 2, 7 * MM, 8);
    if (label.option) {
      center(page, font, clip(label.option, 20), LABEL_W / 2, 4.5 * MM, 7, rgb(0.4, 0.4, 0.4));
    }
    const vendor = clip(label.vendor, 15);
    if (vendor) {
      page.drawText(vendor, {
        x: 1.5 * MM,
        y: 2 * MM,
        size: 6,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }
  doc.setTitle('입고 바코드');
  return doc.save();
}
