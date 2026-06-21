"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function NaverCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("네이버 로그인 처리 중...");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const redirectTo = sessionStorage.getItem("naver_redirect_to") || "/home";

    if (error || !code) {
      setStatus("네이버 로그인이 취소되었습니다.");
      setIsError(true);
      setTimeout(() => router.push("/login"), 2000);
      return;
    }

    handleCallback(code, redirectTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCallback(code: string, redirectTo: string) {
    try {
      const redirectUri = `${window.location.origin}/auth/naver/callback`;

      const res = await fetch("/api/auth/naver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, redirectUri }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "로그인 처리에 실패했습니다.");
      }

      const supabase = createClient();
      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
      }

      sessionStorage.removeItem("naver_redirect_to");
      setStatus("로그인 성공! 이동 중...");
      router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "네이버 로그인에 실패했습니다.");
      setIsError(true);
      setTimeout(() => router.push("/login"), 3000);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-6">
        {isError ? (
          <div className="space-y-3">
            <div className="text-4xl">❌</div>
            <p className="text-gray-700 font-medium">{status}</p>
            <p className="text-sm text-gray-400">로그인 페이지로 돌아갑니다...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-600 text-sm">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NaverCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NaverCallbackContent />
    </Suspense>
  );
}
