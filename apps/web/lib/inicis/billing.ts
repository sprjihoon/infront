import crypto from "crypto";

/** KG Inicis 빌링(정기결제) MID — 승인 가맹점 infrontbil */
export const BILLING_MID_PRODUCTION = "infrontbil";

const TEST_MID = "INIpayTest";
const TEST_SIGN_KEY = "SU5JTElURV9UUklQTEVERVNfS0VZU1JS";

export const REBILL_URL = "https://iniapi.inicis.com/api/v1/bill";
export const CANCEL_BILL_KEY_URL = "https://iniapi.inicis.com/api/v1/bill/delete";

export type BillingCredentials = {
  mid: string;
  signKey: string;
  iniapiKey: string;
  iniapiIv: string;
  isTest: boolean;
  jsUrl: string;
};

export function sha256hex(str: string): string {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

/** Vercel/PowerShell 주입 시 붙는 `\r\n` 리터럴·개행 제거 */
export function cleanEnv(value: string | undefined | null): string {
  return (value ?? "")
    .replace(/\\r\\n/g, "")
    .replace(/\\n/g, "")
    .replace(/\\r/g, "")
    .replace(/[\r\n]/g, "")
    .trim();
}

/**
 * 빌링 전용 자격증명.
 * - INICIS_TEST_MODE=true → INIpayTest 스테이징
 * - 그 외 → INICIS_BILLING_* 필수 (미설정 시 null)
 */
export function getBillingCredentials(): BillingCredentials | null {
  const forceTest = cleanEnv(process.env.INICIS_TEST_MODE) === "true";

  if (forceTest) {
    return {
      mid: TEST_MID,
      signKey: TEST_SIGN_KEY,
      iniapiKey: cleanEnv(
        process.env.INICIS_BILLING_INIAPI_KEY ?? process.env.INICIS_INIAPI_KEY,
      ),
      iniapiIv: cleanEnv(
        process.env.INICIS_BILLING_INIAPI_IV ?? process.env.INICIS_INIAPI_IV,
      ),
      isTest: true,
      jsUrl: "https://stgstdpay.inicis.com/stdjs/INIStdPay.js",
    };
  }

  const mid = cleanEnv(process.env.INICIS_BILLING_MID);
  const signKey = cleanEnv(process.env.INICIS_BILLING_SIGN_KEY);
  const iniapiKey = cleanEnv(
    process.env.INICIS_BILLING_INIAPI_KEY ?? process.env.INICIS_INIAPI_KEY,
  );
  const iniapiIv = cleanEnv(
    process.env.INICIS_BILLING_INIAPI_IV ?? process.env.INICIS_INIAPI_IV,
  );

  if (!mid || !signKey) return null;

  return {
    mid,
    signKey,
    iniapiKey,
    iniapiIv,
    isTest: false,
    jsUrl: "https://stdpay.inicis.com/stdjs/INIStdPay.js",
  };
}

/** INIStdPay 서명 필드 */
export function buildStdPaySignatures(
  oid: string,
  price: string,
  timestamp: string,
  signKey: string,
) {
  return {
    signature: sha256hex(`oid=${oid}&price=${price}&timestamp=${timestamp}`),
    verification: sha256hex(`oid=${oid}&price=${price}&signKey=${signKey}&timestamp=${timestamp}`),
    mKey: sha256hex(signKey),
  };
}

/** INIAPI AES-128-CBC signData */
export function buildIniapiSignData(
  plain: string,
  iniapiKey: string,
  iniapiIv: string,
): string {
  if (!iniapiKey || !iniapiIv) {
    throw new Error("INIAPI KEY/IV 환경변수 누락");
  }
  const cipher = crypto.createCipheriv(
    "aes-128-cbc",
    Buffer.from(iniapiKey, "utf8"),
    Buffer.from(iniapiIv, "utf8"),
  );
  return Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]).toString("base64");
}

export function buildRebillSignData(
  mid: string,
  billKey: string,
  msg: string,
  price: string,
  timestamp: string,
  iniapiKey: string,
  iniapiIv: string,
): string {
  return buildIniapiSignData(
    `Rebill${mid}${billKey}${msg}${price}${timestamp}`,
    iniapiKey,
    iniapiIv,
  );
}

export function buildBillKeyCancelSignData(
  mid: string,
  billKey: string,
  msg: string,
  timestamp: string,
  iniapiKey: string,
  iniapiIv: string,
): string {
  return buildIniapiSignData(
    `BillKeyCancel${mid}${billKey}${msg}${timestamp}`,
    iniapiKey,
    iniapiIv,
  );
}

export function parseIniapiResponse(resText: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    Object.assign(result, JSON.parse(resText));
  } catch {
    new URLSearchParams(resText).forEach((v, k) => {
      result[k] = v;
    });
  }
  return result;
}

export function isIniapiSuccess(result: Record<string, string>): boolean {
  const code = result.resultCode ?? result.P_STATUS ?? "";
  return code === "00" || code === "0000";
}

/** 다음 결제일: 다음 달 1일 (YYYY-MM-DD) */
export function nextBillingDateFirstOfMonth(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return d.toISOString().split("T")[0]!;
}

export type RebillResult =
  | { ok: true; tid: string; resultCode: string; raw: Record<string, string> }
  | { ok: false; resultCode: string; resultMsg: string; raw: Record<string, string> };

/** INIAPI Rebill 호출 */
export async function callRebill(params: {
  mid: string;
  billKey: string;
  msg: string;
  price: string;
  iniapiKey: string;
  iniapiIv: string;
}): Promise<RebillResult> {
  const type = "Rebill";
  const timestamp = Date.now().toString();
  const signData = buildRebillSignData(
    params.mid,
    params.billKey,
    params.msg,
    params.price,
    timestamp,
    params.iniapiKey,
    params.iniapiIv,
  );

  const body = new URLSearchParams({
    type,
    mid: params.mid,
    tid: params.billKey,
    msg: params.msg,
    price: params.price,
    timestamp,
    signData,
  });

  const res = await fetch(REBILL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
    body: body.toString(),
  });
  const raw = parseIniapiResponse(await res.text());
  const resultCode = raw.resultCode ?? raw.P_STATUS ?? "";
  const resultMsg = raw.resultMsg ?? raw.P_RMESG1 ?? "알 수 없는 오류";
  const tid = raw.tid ?? raw.TID ?? "";

  if (!isIniapiSuccess(raw)) {
    return { ok: false, resultCode, resultMsg, raw };
  }
  return { ok: true, tid, resultCode, raw };
}
