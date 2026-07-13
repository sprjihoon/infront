/**
 * 테스트 계정 생성 스크립트
 * 이메일 인증 없이 즉시 활성화된 계정을 만듭니다.
 *
 * 실행 방법:
 *   node scripts/create-test-user.mjs
 *
 * 환경변수가 필요합니다:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 아래 이메일/비밀번호를 원하는 값으로 수정하세요.
 */

const EMAIL    = "test@infront.kr";
const PASSWORD = "Test1234!";

function cleanEnv(v) {
  return (v ?? "").replace(/\\r\\n|\\r|\\n|\r|\n|"/g, "").trim();
}
const url    = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const svcKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!url || !svcKey) {
  console.error("❌ 환경변수를 먼저 설정해주세요:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  console.error("");
  console.error("   vercel env pull .env.local.full 실행 후:");
  console.error("   node -e \"require('dotenv').config({path:'.env.local.full'})\" scripts/create-test-user.mjs");
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    "Content-Type":  "application/json",
    "apikey":        svcKey,
    "Authorization": `Bearer ${svcKey}`,
  },
  body: JSON.stringify({
    email:            EMAIL,
    password:         PASSWORD,
    email_confirm:    true,   // 이메일 인증 생략
    user_metadata:    { name: "테스트 계정" },
  }),
});

const data = await res.json();

if (!res.ok) {
  if (data.msg?.includes("already been registered") || data.code === "email_exists") {
    console.log("ℹ️  이미 존재하는 계정입니다:", EMAIL);
    console.log("   비밀번호:", PASSWORD);
  } else {
    console.error("❌ 생성 실패:", JSON.stringify(data, null, 2));
    process.exit(1);
  }
} else {
  console.log("✅ 테스트 계정 생성 완료!");
  console.log("   이메일:   ", EMAIL);
  console.log("   비밀번호: ", PASSWORD);
  console.log("   User ID:  ", data.id);
  console.log("");
  console.log("   로그인 URL: https://infront.kr/login");
  console.log("   샵 URL:    https://infront.kr/shop");
}
