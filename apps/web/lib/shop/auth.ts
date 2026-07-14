import { createClient } from "@/lib/supabase/server";
import type { CustomerType } from "./products";

export interface ShopAuthUser {
  id: string;
  email: string | undefined;
  customerType: CustomerType;
  name: string | null;
  phone: string | null;
}

export async function getShopAuthUser(): Promise<ShopAuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("customer_type, name, phone, email")
    .eq("id", user.id)
    .maybeSingle();

  const meta = user.user_metadata as { customer_type?: string; name?: string; phone?: string };
  const customerType: CustomerType =
    customer?.customer_type === "foreigner" || meta.customer_type === "foreigner"
      ? "foreigner"
      : "domestic";

  return {
    id: user.id,
    email: user.email ?? customer?.email ?? undefined,
    customerType,
    name: customer?.name ?? meta.name ?? null,
    phone: customer?.phone ?? meta.phone ?? null,
  };
}
