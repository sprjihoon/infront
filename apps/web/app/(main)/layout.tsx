import BottomTabBar from "@/components/ui/BottomTabBar";
import SidebarWrapper from "@/components/ui/SidebarWrapper";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ?? ??? ? mx-auto ? ?? ?? ??? ?? */}
      <div
        className="w-full max-w-[600px] mx-auto min-h-screen pb-[calc(60px+var(--sab,0px))]"
        style={{ paddingTop: "var(--sat, 0px)" }}
      >
        {children}
      </div>

      {/* ??? ?? ? lg ???? ?? ???? ?? ?? */}
      {/* calc(50% + 300px + 24px) = ?? ?? + ?? ?? + gap */}
      <div
        className="hidden lg:block fixed top-4"
        style={{ left: "calc(50% + 300px + 24px)" }}
      >
        <SidebarWrapper />
      </div>

      <BottomTabBar />
    </div>
  );
}
