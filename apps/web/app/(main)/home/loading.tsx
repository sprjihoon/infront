export default function HomeLoading() {
  return (
    <div className="px-4 py-5 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-48 bg-gray-100 rounded" />
        </div>
        <div className="w-9 h-9 bg-gray-200 rounded-full" />
      </div>
      <div className="space-y-2.5">
        <div className="h-4 w-16 bg-gray-200 rounded" />
        <div className="h-[68px] bg-gray-100 rounded-2xl" />
        <div className="h-[68px] bg-gray-100 rounded-2xl" />
        <div className="h-[68px] bg-gray-100 rounded-2xl" />
      </div>
      <div className="h-44 bg-gray-100 rounded-2xl" />
    </div>
  );
}
