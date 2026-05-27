/**
 * 관리자 계정 생성/비밀번호 재설정
 *
 * 사용법 (apps/admin 디렉터리에서):
 *   node scripts/create-admin.mjs
 *   node scripts/create-admin.mjs --email you@example.com --password 'YourPass123!'
 *
 * ADMIN_EMAILS(.env.local)에 등록된 이메일만 관리자 로그인 가능
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) out.email = args[++i];
    if (args[i] === "--password" && args[i + 1]) out.password = args[++i];
  }
  return out;
}

loadEnv();

const { email: argEmail, password: argPassword } = parseArgs();
const email = (argEmail ?? process.env.ADMIN_EMAILS?.split(",")[0] ?? "admin@infront.kr")
  .trim()
  .toLowerCase();
const password = argPassword ?? "InfrontAdmin2026!";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요 (.env.local)");
  process.exit(1);
}

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

if (!adminEmails.includes(email)) {
  console.warn(`경고: ${email} 이(가) ADMIN_EMAILS에 없습니다.`);
  console.warn(`현재 ADMIN_EMAILS: ${adminEmails.join(", ") || "(비어 있음)"}`);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("비밀번호 재설정 실패:", error.message);
    process.exit(1);
  }
  console.log("기존 계정 비밀번호를 재설정했습니다.");
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "admin" },
  });
  if (error) {
    console.error("계정 생성 실패:", error.message);
    console.error("handle_new_user 트리거 오류일 수 있습니다. apps/sql/018_fix_handle_new_user.sql 실행 여부를 확인하세요.");
    process.exit(1);
  }
  console.log("새 관리자 계정을 생성했습니다.", data.user.id);
}

console.log("");
console.log("로그인 정보");
console.log("  URL     : http://localhost:3001/login");
console.log("  이메일  :", email);
console.log("  비밀번호:", password);
