"use client";

import { usePathname } from "next/navigation";
import SidebarCalculator from "./SidebarCalculator";
import SidebarShippingCalcInfo from "./SidebarShippingCalcInfo";
import SidebarDomesticCalculator from "./SidebarDomesticCalculator";

export default function SidebarWrapper() {
  const pathname = usePathname();

  if (pathname === "/shipping-calc") {
    return <SidebarShippingCalcInfo />;
  }

  if (pathname.startsWith("/domestic-shipping") || pathname.startsWith("/domestic-rates")) {
    return <SidebarDomesticCalculator />;
  }

  return <SidebarCalculator />;
}
