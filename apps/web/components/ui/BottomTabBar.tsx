"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, FileText, User } from "lucide-react";

const TABS = [
  { href: "/home", label: "홈", icon: Home },
  { href: "/warehouse", label: "마이창고", icon: Package },
  { href: "/orders", label: "배송현황", icon: FileText },
  { href: "/mypage", label: "마이페이지", icon: User },
];

export default function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50"
      style={{ paddingBottom: "var(--sab, 0px)" }}
    >
      <div className="max-w-[430px] mx-auto flex">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
            >
              <Icon
                size={22}
                className={active ? "text-blue-600" : "text-gray-400"}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span
                className={`text-[10px] font-medium ${
                  active ? "text-blue-600" : "text-gray-400"
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
