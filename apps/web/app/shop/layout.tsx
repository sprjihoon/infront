import { ShopFooter } from "./components/ShopFooter";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex-1">{children}</div>
      <ShopFooter />
    </div>
  );
}
