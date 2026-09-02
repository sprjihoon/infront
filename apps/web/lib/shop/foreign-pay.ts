import type { ShopAuthUser } from "./auth";

export function assertForeignPaypalUser(
  user: ShopAuthUser | null,
): { ok: true } | { ok: false; error: string; status: number } {
  if (!user) {
    return {
      ok: false,
      error: "결제는 회원 주문에서만 이용 가능합니다. 로그인 또는 회원가입 후 이용해주세요.",
      status: 401,
    };
  }
  if (user.customerType !== "foreigner") {
    return {
      ok: false,
      error: "PayPal은 외국인/해외고객 회원만 이용 가능합니다.",
      status: 403,
    };
  }
  if (!user.emailConfirmed) {
    return {
      ok: false,
      error:
        "PayPal은 이메일 인증이 완료된 회원만 이용 가능합니다. 가입 시 발송된 인증 메일을 확인해 주세요.",
      status: 403,
    };
  }
  return { ok: true };
}
