"use client";

import { usePathname } from "next/navigation";
import SidebarCalculator from "./SidebarCalculator";
import SidebarShippingCalcInfo from "./SidebarShippingCalcInfo";

export default function SidebarWrapper() {
  const pathname = usePathname();
  const isShippingCalc = pathname === "/shipping-calc";

  if (isShippingCalc) {
    return <SidebarShippingCalcInfo />;
  }

  return <SidebarCalculator />;
}
