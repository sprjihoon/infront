"use client";

import { usePathname } from "next/navigation";
import SidebarCalculator from "./SidebarCalculator";
import SidebarCustomsInfo from "./SidebarCustomsInfo";

export default function SidebarWrapper() {
  const pathname = usePathname();

  if (pathname === "/shipping-calc") {
    return (
      <div className="hidden lg:block pt-4">
        <SidebarCustomsInfo />
      </div>
    );
  }

  return (
    <div className="hidden lg:block pt-4">
      <SidebarCalculator />
    </div>
  );
}
