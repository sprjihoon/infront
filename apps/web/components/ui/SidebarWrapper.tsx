"use client";

import { usePathname } from "next/navigation";
import SidebarCalculator from "./SidebarCalculator";
import SidebarRateTable from "./SidebarRateTable";

export default function SidebarWrapper() {
  const pathname = usePathname();

  if (pathname === "/shipping-calc") {
    return (
      <div className="hidden lg:block pt-4">
        <SidebarRateTable />
      </div>
    );
  }

  return (
    <div className="hidden lg:block pt-4">
      <SidebarCalculator />
    </div>
  );
}
