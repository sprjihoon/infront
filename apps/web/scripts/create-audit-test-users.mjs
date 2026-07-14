/**
 * KG이니시스 심사용 테스트 계정 2종 생성/갱신
 *
 * - audit-domestic@infront.kr   내국인 + 이메일 인증 완료
 * - audit-foreigner@infront.kr  외국인/해외고객 + 이메일 인증 완료
 *
 * 사용법 (apps/web):
 *   node scripts/create-audit-test-users.mjs
 *
 * 필요 환경변수 (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPaths = [
    join(__dirname, "..", ".env.local"),
    join(__dirname, "..", ".env.local.full"),
    join(__dirname, "..", "..", "admin", ".env.local"),
    join(__dirname, "..", "..", "admin", ".env.local.full"),
  ];
  for (const path of envPaths) {
    try {
      for (const line of readFileSync(path, "utf8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i <= 0) continue;
        const key = t.slice(0, i).trim();
        if (!process.env[key]) {
          process.env[key] = t.slice(i + 1).trim();
        }
      }
    } catch {
      /* try next */
    }
  }
}

loadEnv();

function cleanEnv(v) {
  return (v ?? "").replace(/\\r\\n|\\r|\\n|\r|\n|"/g, "").trim();
}

const ACCOUNTS = [
  {
    email: "audit-domestic@infront.kr",
    password: "AuditDomestic2026!",
    name: "심사내국인",
    phone: "010-1111-0001",
    customerType: "domestic",
  },
  {
    email: "audit-foreigner@infront.kr",
    password: "AuditForeign2026!",
    name: "Audit Foreigner",
    phone: "010-2222-0002",
    customerType: "foreigner",
  },
];

const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요 (.env.local)");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upsertAccount(spec) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find(
    (u) => u.email?.toLowerCase() === spec.email.toLowerCase()
  );

  let userId;

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: spec.password,
      email_confirm: true,
      user_metadata: {
        name: spec.name,
        phone: spec.phone,
        customer_type: spec.customerType,
      },
    });
    if (error) throw new Error(`${spec.email} update failed: ${error.message}`);
    userId = data.user.id;
    console.log(`♻️  갱신: ${spec.email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
      user_metadata: {
        name: spec.name,
        phone: spec.phone,
        customer_type: spec.customerType,
      },
    });
    if (error) throw new Error(`${spec.email} create failed: ${error.message}`);
    userId = data.user.id;
    console.log(`✅ 생성: ${spec.email}`);
  }

  const { error: custErr } = await admin
    .from("customers")
    .update({
      name: spec.name,
      phone: spec.phone,
      customer_type: spec.customerType,
    })
    .eq("id", userId);

  if (custErr) {
    console.warn(`⚠️  customers 업데이트 경고 (${spec.email}):`, custErr.message);
  }

  return userId;
}

console.log("KG이니시스 심사용 테스트 계정 준비 중...\n");

for (const spec of ACCOUNTS) {
  await upsertAccount(spec);
}

console.log("\n── 로그인 정보 ──");
for (const spec of ACCOUNTS) {
  console.log(`\n[${spec.customerType === "foreigner" ? "외국인/해외고객" : "내국인"}]`);
  console.log(`  이메일:   ${spec.email}`);
  console.log(`  비밀번호: ${spec.password}`);
}

console.log("\n── 심사 캡처 URL ──");
console.log("  가입:     https://infront.kr/signup");
console.log("  마이페이지: https://infront.kr/mypage");
console.log("  checkout(내국인): https://infront.kr/shop/checkout?product=PICKUP_FEE");
console.log("  checkout(외국인): audit-foreigner@infront.kr 로그인 후 동일 URL");
console.log("  주문목록: https://infront.kr/shop/orders");
console.log("  admin:    https://admin.infront.kr/shop-orders");
console.log("\n완료.");
