"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SAVED_EMAIL_KEY = "infront_saved_email";
const SAVED_PASSWORD_KEY = "infront_saved_password";

function getSavedEmail() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SAVED_EMAIL_KEY) ?? "";
}

function getSavedPassword() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SAVED_PASSWORD_KEY) ?? "";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(getSavedEmail);
  const [password, setPassword] = useState(getSavedPassword);
  const [rememberMe, setRememberMe] = useState(() => !!getSavedEmail());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    router.push("/home");
    router.refresh();
  }

  return (
    <div className="py-12">
      {/* 로고 */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
          <span className="text-white text-2xl font-bold">S</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">인프론트</h1>
        <p className="text-gray-500 text-sm mt-1">해외배송 대행 서비스</p>
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
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 아이디 저장 */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={() => setRememberMe((v) => !v)}
              className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-colors ${
                rememberMe ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"
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

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="text-blue-600 font-medium">
          회원가입
        </Link>
      </p>
    </div>
  );
}
