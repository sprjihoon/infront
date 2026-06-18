/**
 * 홈 페이지 로딩 스켈레톤
 * 서버 컴포넌트 데이터 조회 중 즉시 표시
 */
export default function HomeLoading() {
  return (
    <div className="w-full max-w-[600px] mx-auto min-h-screen pb-[calc(60px+var(--sab,0px))] animate-pulse">
      {/* 상단 헤더 */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-6 w-32 bg-gray-300 rounded" />
        </div>
        <div className="w-9 h-9 bg-gray-200 rounded-full" />
      </div>

      {/* 액션 버튼 그리드 */}
      <div className="px-4 mb-5">
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-gray-200 rounded-2xl" />
              <div className="h-3 w-10 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 최근 소포 섹션 헤더 */}
      <div className="px-4 mb-3 flex items-center justify-between">
        <div className="h-5 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </div>

      {/* 소포 카드 리스트 */}
      <div className="px-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1.5">
                <div className="h-4 w-28 bg-gray-200 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
              <div className="h-6 w-16 bg-gray-100 rounded-full" />
            </div>
            <div className="h-3 w-full bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
