import { getShopAuthUser } from "./auth";
import {
  getOneTimeProduct,
  getOrderTotal,
  getPaymentMethodCode,
  getPaymentMethodLabel,
  getPaymentItemType,
  getShippingType,
  isGlobalPaymentMethod,
  isOpenGlobalPaymentMethod,
  isTrackingAvailable,
  type ShopProduct,
} from "./products";
import type { ShopAuthUser } from "./auth";

export interface ValidatedShopOrder {
  user: ShopAuthUser;
  product: ShopProduct;
  price: number;
  goodname: string;
  paymentMethodId: string;
  paymentMethod: string;
  paymentMethodCode: string;
  isForeignCard: boolean;
  paymentItemType: "one_time" | "recurring";
  paymentItemKey: string;
  shippingType: "domestic" | "intl" | "none";
  trackingAvailable: boolean;
}

export async function validateShopOrderRequest(
  productId: string | undefined,
  buyername: string | undefined,
  buyertel: string | undefined,
  buyeremail: string | undefined,
  paymentMethodId?: string
): Promise<{ ok: true; data: ValidatedShopOrder } | { ok: false; error: string; status: number }> {
  const user = await getShopAuthUser();
  if (!user) {
    return {
      ok: false,
      error: "결제는 회원 주문에서만 이용 가능합니다. 로그인 또는 회원가입 후 이용해주세요.",
      status: 401,
    };
  }

  if (!buyername || !buyertel || !buyeremail) {
    return { ok: false, error: "필수 파라미터 누락", status: 400 };
  }

  const product = getOneTimeProduct(productId ?? "");
  if (!product) {
    return { ok: false, error: "유효하지 않은 상품입니다.", status: 400 };
  }

  const methodId = paymentMethodId ?? "card";

  if (isGlobalPaymentMethod(methodId) && !isOpenGlobalPaymentMethod(methodId)) {
    return {
      ok: false,
      error: "해외카드는 PayPal로 결제해 주세요. Alipay·WeChat Pay 또는 국내 결제수단도 이용할 수 있습니다.",
      status: 403,
    };
  }

  if (isOpenGlobalPaymentMethod(methodId)) {
    if (user.customerType !== "foreigner") {
      return {
        ok: false,
        error: "PayPal·Alipay·WeChat Pay는 외국인/해외고객 회원만 이용 가능합니다.",
        status: 403,
      };
    }
    if (!user.emailConfirmed) {
      return {
        ok: false,
        error:
          "글로벌 결제는 이메일 인증이 완료된 회원만 이용 가능합니다. 가입 시 발송된 인증 메일을 확인해 주세요.",
        status: 403,
      };
    }
    if (product.billingType !== "one_time" && methodId !== "paypal") {
      return {
        ok: false,
        error: "Alipay·WeChat Pay는 단건 서비스에만 사용할 수 있습니다. 정기결제는 PayPal을 이용해 주세요.",
        status: 403,
      };
    }
  }

  const price = getOrderTotal(product);
  if (price <= 0) {
    return { ok: false, error: "유효하지 않은 결제 금액입니다.", status: 400 };
  }

  const paymentMethodCode = getPaymentMethodCode(methodId);

  return {
    ok: true,
    data: {
      user,
      product,
      price,
      goodname: product.name,
      paymentMethodId: methodId,
      paymentMethod: getPaymentMethodLabel(methodId, "ko"),
      paymentMethodCode,
      isForeignCard: methodId === "intl_card",
      paymentItemType: getPaymentItemType(product),
      paymentItemKey: product.paymentItemKey,
      shippingType: getShippingType(product),
      trackingAvailable: isTrackingAvailable(product),
    },
  };
}
