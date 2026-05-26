"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface SubPageHeaderProps {
  title: string;
  subtitle?: string;
}

export default function SubPageHeader({ title, subtitle }: SubPageHeaderProps) {
  const router = useRouter();

  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => router.back()} className="p-1 -ml-1">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
