"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  RotateCcw,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  PanelLeft,
  PanelLeftClose,
  Truck,
  Warehouse,
  LayoutGrid,
  SlidersHorizontal,
  ScanLine,
  MoveRight,
  LucideIcon,
  ClipboardList,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    title: "메인",
    icon: LayoutDashboard,
    items: [{ title: "대시보드", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    id: "outbound",
    title: "출고",
    icon: Send,
    items: [
      { title: "피킹 지시서", href: "/picking", icon: ClipboardList },
      { title: "출고처리", href: "/outbound", icon: Send },
    ],
  },
  {
    id: "operations",
    title: "운영",
    icon: Package,
    items: [
      { title: "입고처리", href: "/inbound", icon: ScanLine },
      { title: "수거·입고 목록", href: "/parcels", icon: Package },
      { title: "해외배송", href: "/orders", icon: ShoppingBag },
      { title: "국내배송", href: "/domestic-orders", icon: Truck },
      { title: "고객", href: "/customers", icon: Users },
      { title: "반품 관리", href: "/returns", icon: RotateCcw },
    ],
  },
  {
    id: "storage",
    title: "스토리지",
    icon: Warehouse,
    items: [
      { title: "로케이션 현황", href: "/storage", icon: LayoutGrid },
      { title: "이동처리", href: "/transfer", icon: MoveRight },
      { title: "Zone·슬롯 관리", href: "/storage/manage", icon: SlidersHorizontal },
    ],
  },
];

const STORAGE_EXPANDED = "infront-admin-nav-expanded";
const STORAGE_COLLAPSED = "infront-admin-nav-collapsed";

export default function DashboardNav() {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["main", "outbound", "operations"]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedExpanded = localStorage.getItem(STORAGE_EXPANDED);
      const savedCollapsed = localStorage.getItem(STORAGE_COLLAPSED);
      if (savedExpanded) setExpandedGroups(JSON.parse(savedExpanded));
      if (savedCollapsed) setIsCollapsed(JSON.parse(savedCollapsed));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_EXPANDED, JSON.stringify(expandedGroups));
  }, [expandedGroups, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_COLLAPSED, JSON.stringify(isCollapsed));
  }, [isCollapsed, hydrated]);

  const isItemActive = useCallback(
    (href: string) => {
      if (href === "/dashboard") return pathname === href;
      // /storage 는 /storage/manage 와 구분
      if (href === "/storage") {
        return pathname === "/storage" || (
          pathname.startsWith("/storage/") && !pathname.startsWith("/storage/manage")
        );
      }
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return NAV_GROUPS;
    const q = searchQuery.toLowerCase();
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          group.title.toLowerCase().includes(q),
      ),
    })).filter((group) => group.items.length > 0);
  }, [searchQuery]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const renderNavItem = (item: NavItem) => {
    const active = isItemActive(item.href);
    if (isCollapsed) {
      return (
        <Link
          key={item.href}
          href={item.href}
          title={item.title}
          className={cn(
            "flex items-center justify-center p-2.5 rounded-lg transition-colors",
            active
              ? "bg-primary text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
          )}
        >
          <item.icon className="h-5 w-5" />
        </Link>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          active
            ? "bg-primary text-white shadow-sm"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span>{item.title}</span>
      </Link>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const expanded = expandedGroups.includes(group.id);
    const hasActive = group.items.some((item) => isItemActive(item.href));

    if (isCollapsed) {
      return (
        <div key={group.id} className="space-y-1">
          {group.items.map(renderNavItem)}
        </div>
      );
    }

    return (
      <div key={group.id} className="space-y-1">
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          className={cn(
            "flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors",
            hasActive ? "text-primary bg-primary/5" : "text-gray-500 hover:bg-gray-50",
          )}
        >
          <span className="flex items-center gap-2">
            <group.icon className="h-4 w-4" />
            {group.title}
          </span>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div
          className={cn(
            "overflow-hidden transition-all duration-200",
            expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="ml-2 pl-2 border-l-2 border-gray-100 space-y-1 py-1">
            {group.items.map(renderNavItem)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "bg-white border-r border-gray-200 min-h-screen flex flex-col transition-all duration-300 shrink-0",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("p-4", isCollapsed && "px-2")}>
        <Link
          href="/dashboard"
          className={cn("flex items-center mb-4", isCollapsed ? "justify-center" : "gap-2.5")}
        >
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <Package size={18} className="text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <p className="text-base font-bold text-gray-900">인프론트</p>
              <p className="text-xs text-gray-500">관리자 콘솔</p>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={() => setIsCollapsed((v) => !v)}
          className={cn(
            "flex items-center justify-center w-full p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors text-xs",
            !isCollapsed && "gap-2",
          )}
        >
          {isCollapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5" />
              <span>메뉴 접기</span>
            </>
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div className="px-4 mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="메뉴 검색..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 px-2 pb-4 space-y-3 overflow-y-auto">
        {filteredGroups.map(renderGroup)}
        {searchQuery && filteredGroups.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-gray-400">검색 결과가 없습니다</p>
        )}
      </nav>
    </aside>
  );
}
