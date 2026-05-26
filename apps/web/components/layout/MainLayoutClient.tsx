"use client";

import BottomTabBar from "@/components/ui/BottomTabBar";
import SidebarWrapper from "@/components/ui/SidebarWrapper";
import MainFlowHeader from "@/components/layout/MainFlowHeader";
import { FlowModeProvider } from "@/lib/flow-mode";

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <FlowModeProvider>
      <div className="min-h-screen bg-gray-50">
        <div
          className="w-full max-w-[600px] mx-auto min-h-screen pb-[calc(60px+var(--sab,0px))]"
          style={{ paddingTop: "var(--sat, 0px)" }}
        >
          <MainFlowHeader />
          {children}
        </div>

        <div
          className="hidden lg:block fixed top-4 w-72 max-h-[calc(100vh-2rem)] z-[1]"
          style={{ left: "calc(50% + 300px + 24px)" }}
        >
          <SidebarWrapper />
        </div>

        <BottomTabBar />
      </div>
    </FlowModeProvider>
  );
}
