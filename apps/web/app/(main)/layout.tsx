import BottomTabBar from "@/components/ui/BottomTabBar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-gray-50">
      <div
        className="max-w-[430px] mx-auto min-h-screen pb-[calc(60px+var(--sab,0px))]"
        style={{ paddingTop: "var(--sat, 0px)" }}
      >
        {children}
      </div>
      <BottomTabBar />
    </div>
  );
}
