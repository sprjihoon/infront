export interface InsertOrderParams {
  custNo: string;
  apprNo: string;
  payType: '1' | '2';
  reqType: '1' | '2';
  officeSer?: string;
  orderNo: string;
  recNm: string;
  recZip: string;
  recAddr1: string;
  recAddr2: string;
  recTel?: string;
  recMob?: string;
  contCd: string;
  goodsNm: string;
  weight?: number;
  volume?: number;
  microYn?: 'Y' | 'N';
  ordCompNm?: string;
  ordNm?: string;
  ordZip?: string;
  ordAddr1?: string;
  ordAddr2?: string;
  ordTel?: string;
  ordMob?: string;
  delivMsg?: string;
  insuYn?: 'Y' | 'N';
  insuAmt?: number;
  testYn?: 'Y' | 'N';
  printYn?: 'Y' | 'N';
  inqTelCn?: string;
}

export interface InsertOrderResponse {
  reqNo: string;
  resNo: string;
  regiNo: string;
  orderNo?: string;
  regiPoNm: string;
  resDate: string;
  price: string;
  vTelNo?: string;
  insuFee?: string;
  islandAddFee?: string;
  notifyMsg?: string;
}

/** treatStusCd 상태코드: 00=신청접수, 01=집하완료(수거완료), 02=수거중, 03=배달완료 */
export const EPOST_TREAT_STATUS: Record<string, string> = {
  '00': '신청접수',
  '01': '집하완료',
  '02': '수거중',
  '03': '배달완료',
};

export interface GetResInfoParams {
  custNo?: string;
  reqType: '1' | '2';
  orderNo: string;
  reqYmd: string; // YYYYMMDD
}

export interface GetResInfoResponse {
  reqNo: string;
  resNo: string;
  regiNo: string;
  regiPoNm: string;
  resDate: string;
  price: string;
  vTelNo?: string;
  treatStusCd: string;
  treatStusNm?: string;
}

export interface CancelOrderParams {
  custNo: string;
  apprNo: string;
  reqType: '1' | '2';
  payType?: '1' | '2';
  reqNo: string;
  resNo: string;
  regiNo: string;
  reqYmd?: string;
  delYn: 'Y' | 'N';
}
