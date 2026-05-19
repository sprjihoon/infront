import BottomTabBar from "@/components/ui/BottomTabBar";
import SidebarCalculator from "@/components/ui/SidebarCalculator";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 모바일: 단일 컬럼 / 데스크탑(lg): 메인 + 오른쪽 계산기 사이드바 */}
      <div className="max-w-5xl mx-auto flex items-start justify-center gap-6 px-4">

        {/* 메인 콘텐츠 */}
        <div
          className="w-full max-w-[430px] min-h-screen pb-[calc(60px+var(--sab,0px))] shrink-0"
          style={{ paddingTop: "var(--sat, 0px)" }}
        >
          {children}
        </div>

        {/* 가견적 사이드바 — lg 이상에서만 표시 */}
        <div className="hidden lg:block pt-4">
          <SidebarCalculator />
        </div>

      </div>

      <BottomTabBar />
    </div>
  );
}
