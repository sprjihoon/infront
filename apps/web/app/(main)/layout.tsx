import QueryProvider from "@/components/QueryProvider";
import MainLayoutClient from "@/components/layout/MainLayoutClient";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <MainLayoutClient>{children}</MainLayoutClient>
    </QueryProvider>
  );
}
