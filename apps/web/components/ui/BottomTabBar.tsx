"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, Truck, Send, User } from "lucide-react";

const TABS = [
  { href: "/home",      label: "홈",     icon: Home },
  { href: "/inbound",   label: "입고신청", icon: Truck },
  { href: "/storage",   label: "스토리지", icon: Package },
  { href: "/shipping",  label: "출고신청", icon: Send },
  { href: "/mypage",    label: "MY",     icon: User },
];

export default function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50"
      style={{ paddingBottom: "var(--sab, 0px)" }}
    >
      <div className="max-w-[600px] mx-auto flex">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
            || (href === "/shipping" && (pathname.startsWith("/shipping-request") || pathname.startsWith("/domestic-shipping")))
            || (href === "/inbound" && (pathname.startsWith("/pickup") || pathname.startsWith("/register-parcel")));
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
            >
              <Icon
                size={20}
                className={active ? "text-brand-600" : "text-gray-400"}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span
                className={`text-[9px] font-medium ${
                  active ? "text-brand-600" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
