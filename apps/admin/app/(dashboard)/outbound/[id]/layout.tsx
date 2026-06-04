/**
 * 출고 워크스테이션 레이아웃
 * 사이드바·헤더를 덮는 전체 화면 작업 공간
 */
export default function WorkstationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      {children}
    </div>
  );
}
