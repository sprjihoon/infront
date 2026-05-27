"use client";

import BottomTabBar from "@/components/ui/BottomTabBar";
import SidebarWrapper from "@/components/ui/SidebarWrapper";
import { FlowModeProvider } from "@/lib/flow-mode";

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <FlowModeProvider>
      <div className="min-h-screen bg-gray-50">
        <div
          className="w-full max-w-[600px] mx-auto min-h-screen pb-[calc(60px+var(--sab,0px))]"
          style={{ paddingTop: "var(--sat, 0px)" }}
        >
          {children}
        </div>

        <div
          className="hidden xl:block fixed top-4 bottom-[calc(60px+var(--sab,0px)+0.5rem)] w-72 overflow-y-auto z-[1]"
          style={{ left: "calc(50% + 300px + 24px)" }}
        >
          <SidebarWrapper />
        </div>

        <BottomTabBar />
      </div>
    </FlowModeProvider>
  );
}
