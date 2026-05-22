"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const SAVED_KEY = "infront_admin_saved_email";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다");

      const res = await fetch("/api/auth");
      if (!res.ok) {
        await supabase.auth.signOut();
        throw new Error("관리자 권한이 없습니다. ADMIN_EMAILS에 등록된 계정으로 로그인하세요.");
      }

      if (rememberMe) localStorage.setItem(SAVED_KEY, email);
      else localStorage.removeItem(SAVED_KEY);

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 pt-8 pb-2 text-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <Package className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">인프론트</h1>
          <p className="text-sm text-gray-500 mt-1">관리자 콘솔에 로그인하세요</p>
        </div>

        <form onSubmit={handleLogin} className="px-6 pb-8 pt-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="admin@example.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white disabled:opacity-60"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            이메일 저장
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-blue-700 transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "로그인"
            )}
          </button>

          <p className="text-center text-xs text-gray-400 pt-1">
            ADMIN_EMAILS에 등록된 계정만 접근 가능합니다
          </p>
        </form>
      </div>
    </div>
  );
}
