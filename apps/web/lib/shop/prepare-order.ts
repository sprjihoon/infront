import { getShopAuthUser } from "./auth";
import {
  getOneTimeProduct,
  getOrderTotal,
  getPaymentMethodCode,
  getPaymentMethodLabel,
  getPaymentItemType,
  getShippingType,
  isGlobalPaymentMethod,
  isTrackingAvailable,
  type ShopProduct,
} from "./products";
import type { ShopAuthUser } from "./auth";

export interface ValidatedShopOrder {
  user: ShopAuthUser;
  product: ShopProduct;
  price: number;
  goodname: string;
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
      error: "해외카드 결제는 회원 주문에서만 이용 가능합니다. 로그인 또는 회원가입 후 이용해주세요.",
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

  if (isGlobalPaymentMethod(methodId)) {
    if (user.customerType !== "foreigner") {
      return {
        ok: false,
        error: "해외카드 및 글로벌 결제수단은 외국인/해외고객 회원만 이용 가능합니다.",
        status: 403,
      };
    }
    if (product.billingType !== "one_time") {
      return {
        ok: false,
        error: "해외카드는 단건 서비스 이용요금 결제에만 사용할 수 있습니다.",
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
