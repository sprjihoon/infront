import { adminDb } from "@/lib/supabase/admin";
import Link from "next/link";
import { Users, ChevronRight, Package, ShoppingBag } from "lucide-react";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  let query = adminDb
    .from("customers")
    .select("id, name, email, customer_code, phone, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,customer_code.ilike.%${q}%`);
  }

  const { data: customers } = await query;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">고객 관리</h1>
        <p className="text-sm text-gray-500 mt-0.5">고객별 물품·주문 조회</p>
      </div>

      <form className="mb-4">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="고객명, 이메일, 고객번호 검색"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">
            검색
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {!customers?.length ? (
          <div className="text-center py-12 text-gray-400">
            <Users size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">고객이 없습니다</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">고객번호</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">이름</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">이메일</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">가입일</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-xs font-medium">{c.customer_code}</td>
                  <td className="py-3 px-4">{c.name ?? "-"}</td>
                  <td className="py-3 px-4 text-gray-500">{c.email}</td>
                  <td className="py-3 px-4 text-gray-400 text-xs">
                    {new Date(c.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/customers/${encodeURIComponent(c.customer_code)}`} className="text-blue-600">
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
