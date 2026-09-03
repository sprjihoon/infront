import { redirect } from "next/navigation";
import { SHOP_UI_ENABLED } from "@/lib/shop/visible";
import { ShopFooter } from "./components/ShopFooter";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  if (!SHOP_UI_ENABLED) redirect("/home");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex-1">{children}</div>
      <ShopFooter />
    </div>
  );
}
