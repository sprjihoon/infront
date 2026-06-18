/**
 * 스토리지 페이지 로딩 스켈레톤
 * Next.js 자동 Suspense — 서버 컴포넌트가 DB 조회하는 동안 즉시 표시됨
 */
export default function StorageLoading() {
  return (
    <div className="w-full max-w-[600px] mx-auto min-h-screen pb-[calc(60px+var(--sab,0px))] animate-pulse">
      {/* 상단 헤더 */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div className="h-6 w-24 bg-gray-200 rounded-lg" />
        <div className="h-8 w-28 bg-gray-200 rounded-xl" />
      </div>

      {/* 카드 캐러셀 영역 */}
      <div className="px-4 mb-4">
        <div className="relative overflow-hidden rounded-3xl bg-gray-100 h-[286px] w-full" />
      </div>

      {/* 점 인디케이터 */}
      <div className="flex justify-center gap-1.5 mb-5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`rounded-full bg-gray-200 ${i === 1 ? "w-4 h-2" : "w-2 h-2"}`}
          />
        ))}
      </div>

      {/* 물품 섹션 헤더 */}
      <div className="px-4 mb-3 flex items-center justify-between">
        <div className="h-5 w-20 bg-gray-200 rounded-md" />
        <div className="h-5 w-16 bg-gray-200 rounded-md" />
      </div>

      {/* 물품 리스트 */}
      <div className="px-4 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100">
            <div className="w-12 h-12 bg-gray-200 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
            <div className="h-6 w-14 bg-gray-100 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
