import BottomTabBar from "@/components/ui/BottomTabBar";
import SidebarWrapper from "@/components/ui/SidebarWrapper";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 메인 콘텐츠 — mx-auto 로 항상 화면 정중앙 고정 */}
      <div
        className="w-full max-w-[430px] mx-auto min-h-screen pb-[calc(60px+var(--sab,0px))]"
        style={{ paddingTop: "var(--sat, 0px)" }}
      >
        {children}
      </div>

      {/* 사이드 위젯 — lg 이상에서 메인 오른쪽에 절대 위치 */}
      {/* calc(50% + 215px + 24px) = 화면 중앙 + 메인 반폭 + gap */}
      <div
        className="hidden lg:block fixed top-4"
        style={{ left: "calc(50% + 215px + 24px)" }}
      >
        <SidebarWrapper />
      </div>

      <BottomTabBar />
    </div>
  );
}
