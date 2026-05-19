import BottomTabBar from "@/components/ui/BottomTabBar";
import SidebarWrapper from "@/components/ui/SidebarWrapper";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 모바일: 단일 컬럼 / 데스크탑(lg): 메인 430px + 오른쪽 사이드 위젯 */}
      <div className="max-w-5xl mx-auto flex items-start justify-center gap-6 px-4">

        {/* 메인 콘텐츠 — 항상 430px 중앙 고정 */}
        <div
          className="w-full max-w-[430px] min-h-screen pb-[calc(60px+var(--sab,0px))] shrink-0"
          style={{ paddingTop: "var(--sat, 0px)" }}
        >
          {children}
        </div>

        {/* 오른쪽 사이드 위젯 — lg 이상, 페이지별 다른 컴포넌트 */}
        <SidebarWrapper />

      </div>

      <BottomTabBar />
    </div>
  );
}
