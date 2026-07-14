"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CustomerType } from "@/lib/shop/products";

function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("domestic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone, customer_type: customerType },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase
        .from("customers")
        .update({ customer_type: customerType, name, phone })
        .eq("id", data.user.id);
    }

    router.push("/home");
    router.refresh();
  }

  return (
    <div className="py-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl mb-4">
          <span className="text-white text-2xl font-bold">S</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
        <p className="text-gray-500 text-sm mt-1">가입 즉시 고객번호가 발급됩니다</p>
        <p className="text-gray-400 text-xs mt-2 px-4 leading-relaxed">
          회원가입 시 이메일 인증을 통해 계정 확인 후 결제 서비스를 이용할 수 있습니다.
        </p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">고객 구분</label>
          <select
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as CustomerType)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          >
            <option value="domestic">내국인</option>
            <option value="foreigner">외국인/해외고객</option>
          </select>
        </div>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">휴대폰 번호</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상"
            minLength={8}
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-brand-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {loading ? "처리 중..." : "가입하기"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-brand-600 font-medium">
          로그인
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center">
          <Loader2 className="animate-spin text-gray-300" size={28} />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
