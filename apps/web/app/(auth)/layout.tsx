import Link from "next/link";
import { BusinessInfoBlock } from "@/components/audit/AuditCaptureChrome";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-y-auto bg-white px-6 flex flex-col items-center">
      <div className="w-full max-w-[600px] py-10 flex-1 flex items-center justify-center">
        {children}
      </div>
      <footer className="w-full max-w-[600px] border-t border-gray-100 py-6">
        <BusinessInfoBlock />
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-3">
          <Link href="/terms" className="text-[11px] text-gray-500 underline underline-offset-2 hover:text-gray-700">
            이용약관
          </Link>
          <Link href="/privacy" className="text-[11px] text-gray-500 underline underline-offset-2 hover:text-gray-700">
            개인정보처리방침
          </Link>
        </div>
      </footer>
    </div>
  );
}
