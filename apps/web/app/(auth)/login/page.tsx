"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SAVED_EMAIL_KEY = "infront_saved_email";
const SAVED_PASSWORD_KEY = "infront_saved_password";

const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID ?? "";

function getSavedEmail() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SAVED_EMAIL_KEY) ?? "";
}

function getSavedPassword() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SAVED_PASSWORD_KEY) ?? "";
}

function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/home";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get("redirect"));
  const [email, setEmail] = useState(getSavedEmail);
  const [password, setPassword] = useState(getSavedPassword);
  const [rememberMe, setRememberMe] = useState(() => !!getSavedEmail());
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const authError = searchParams.get("error");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (rememberMe) {
      localStorage.setItem(SAVED_EMAIL_KEY, email);
      localStorage.setItem(SAVED_PASSWORD_KEY, password);
    } else {
      localStorage.removeItem(SAVED_EMAIL_KEY);
      localStorage.removeItem(SAVED_PASSWORD_KEY);
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("이메일 또는 비밀번호를 확인해주세요.");
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  async function handleKakaoLogin() {
    setSocialLoading("kakao");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });
  }

  async function handleNaverLogin() {
    if (!NAVER_CLIENT_ID) {
      setError("네이버 로그인이 설정되지 않았습니다.");
      return;
    }
    setSocialLoading("naver");
    const callbackUrl = `${window.location.origin}/auth/naver/callback`;
    const state = Math.random().toString(36).substring(2);
    sessionStorage.setItem("naver_redirect_to", redirectTo);
    window.location.href =
      `https://nid.naver.com/oauth2.0/authorize?response_type=code` +
      `&client_id=${NAVER_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
      `&state=${state}`;
  }

  async function handleGoogleLogin() {
    setSocialLoading("google");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });
  }

  async function handleAppleLogin() {
    setSocialLoading("apple");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });
  }

  return (
    <div className="py-12">
      {/* 로고 */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl mb-4">
          <span className="text-white text-2xl font-bold">S</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">인프론트</h1>
        <p className="text-gray-500 text-sm mt-1">해외배송 대행 서비스</p>
        <p className="text-gray-400 text-xs mt-2 px-4 leading-relaxed">
          회원가입 시 이메일 인증을 통해 계정 확인 후 결제 서비스를 이용할 수 있습니다.
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* 아이디 저장 */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={() => setRememberMe((v) => !v)}
              className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-colors ${
                rememberMe ? "bg-brand-600 border-brand-600" : "bg-white border-gray-300"
              }`}
            >
              {rememberMe && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-600">아이디/비밀번호 저장</span>
          </label>
        </div>

        {(error || authError) && (
          <p className="text-red-500 text-sm text-center">
            {error || (authError === "auth_failed" ? "로그인에 실패했습니다. 다시 시도해주세요." : authError)}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-brand-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="text-brand-600 font-medium">
          회원가입
        </Link>
      </p>

      {/* 구분선 */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs text-gray-400 bg-white px-3">
          또는 소셜 로그인
        </div>
      </div>

      {/* 소셜 로그인 버튼 */}
      <div className="space-y-3">
        {/* 카카오 */}
        <button
          type="button"
          onClick={handleKakaoLogin}
          disabled={socialLoading !== null}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-60 active:scale-[0.98]"
          style={{ backgroundColor: "#FEE500", color: "#000000CC" }}
        >
          {socialLoading === "kakao" ? (
            <div className="w-4 h-4 border-2 border-black/30 border-t-black/80 rounded-full animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9 1C4.582 1 1 3.896 1 7.444c0 2.26 1.504 4.248 3.78 5.376L3.9 16.2a.3.3 0 0 0 .44.32L8.5 13.8c.165.012.332.018.5.018 4.418 0 8-2.896 8-6.374C17 3.896 13.418 1 9 1Z"
                fill="#000000CC"
              />
            </svg>
          )}
          카카오로 계속하기
        </button>

        {/* 네이버 */}
        <button
          type="button"
          onClick={handleNaverLogin}
          disabled={socialLoading !== null}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-60 active:scale-[0.98]"
          style={{ backgroundColor: "#03C75A" }}
        >
          {socialLoading === "naver" ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <span className="text-white font-bold text-base leading-none">N</span>
          )}
          네이버로 계속하기
        </button>

        {/* 구글 */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={socialLoading !== null}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 transition-opacity disabled:opacity-60 active:scale-[0.98]"
        >
          {socialLoading === "google" ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
          )}
          Google로 계속하기
        </button>

        {/* 애플 */}
        <button
          type="button"
          onClick={handleAppleLogin}
          disabled={socialLoading !== null}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-medium text-white bg-black transition-opacity disabled:opacity-60 active:scale-[0.98]"
        >
          {socialLoading === "apple" ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
              <path
                d="M13.178 9.545c-.02-2.06 1.682-3.055 1.758-3.1C13.9 4.484 12.08 4.26 11.43 4.24c-1.567-.16-3.073.93-3.87.93-.798 0-2.025-.91-3.33-.885C2.633 4.31 1.15 5.35.413 6.9c-1.5 2.598-.383 6.45 1.07 8.556.713 1.032 1.565 2.19 2.685 2.148 1.08-.044 1.488-.695 2.794-.695 1.307 0 1.67.695 2.813.672 1.163-.02 1.896-1.052 2.6-2.09.82-1.19 1.155-2.355 1.174-2.415-.025-.01-2.247-.863-2.27-3.531Z"
                fill="white"
              />
              <path
                d="M10.54 2.877c.59-.717 .99-1.714.88-2.707-.85.035-1.877.567-2.487 1.283-.547.636-.026 1.596.882 1.596.375 0 .762-.173 .725-.172Z"
                fill="white"
              />
            </svg>
          )}
          Apple로 계속하기
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-gray-400">로딩 중...</div>}>
      <LoginForm />
    </Suspense>
  );
}
