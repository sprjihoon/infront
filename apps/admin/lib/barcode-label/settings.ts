// 텍스트 필드 공통
export interface TextField {
  show: boolean;
  x: number;    // mm, 좌측 기준
  y: number;    // mm, 상단 기준
  fontSize: number; // pt
  bold: boolean;
}

// 상품명은 maxChars 추가
export interface ItemNameField extends TextField {
  maxChars: number;
}

// 바코드 이미지 (크기 별도)
export interface BarcodeImageField {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BarcodeLabelSettings {
  // 라벨 크기 (mm)
  labelWidth: number;
  labelHeight: number;

  // 필드별 위치·크기·폰트
  barcodeImage: BarcodeImageField;
  customerCode: TextField;
  customerName: TextField;
  barcodeNo: TextField;
  itemName: ItemNameField;
  location: TextField;
  date: TextField;
}

// 기본값: 70mm × 30mm
export const DEFAULT_SETTINGS: BarcodeLabelSettings = {
  labelWidth: 70,
  labelHeight: 30,

  barcodeImage:  { x: 1,  y: 6,    width: 68, height: 13 },
  customerCode:  { show: true,  x: 1,  y: 2,    fontSize: 7,   bold: false },
  customerName:  { show: true,  x: 36, y: 2,    fontSize: 7,   bold: true  },
  barcodeNo:     { show: true,  x: 1,  y: 20.5, fontSize: 7.5, bold: false },
  itemName:      { show: true,  x: 1,  y: 25,   fontSize: 6.5, bold: false, maxChars: 16 },
  location:      { show: true,  x: 50, y: 25,   fontSize: 8,   bold: true  },
  date:          { show: false, x: 52, y: 27.5, fontSize: 5.5, bold: false },
};

const STORAGE_KEY = "infront-barcode-label-settings-v2";

export function loadSettings(): BarcodeLabelSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw);
    // 중첩 객체 깊은 병합
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      barcodeImage: { ...DEFAULT_SETTINGS.barcodeImage, ...saved.barcodeImage },
      customerCode: { ...DEFAULT_SETTINGS.customerCode, ...saved.customerCode },
      customerName: { ...DEFAULT_SETTINGS.customerName, ...saved.customerName },
      barcodeNo:    { ...DEFAULT_SETTINGS.barcodeNo,    ...saved.barcodeNo    },
      itemName:     { ...DEFAULT_SETTINGS.itemName,     ...saved.itemName     },
      location:     { ...DEFAULT_SETTINGS.location,     ...saved.location     },
      date:         { ...DEFAULT_SETTINGS.date,         ...saved.date         },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: BarcodeLabelSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
