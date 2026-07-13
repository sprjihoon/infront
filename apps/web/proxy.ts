import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** 로그인 없이 접근 가능한 페이지 */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/home",
  "/shipping-calc",
  "/pricing",
  "/guide",
  "/terms",
  "/privacy",
  "/notices",
  "/support",
  "/shop",
  "/postcode",
  "/auth",
];

/** 계산기 등 비로그인 기능에서 호출하는 API */
const PUBLIC_API_PREFIXES = [
  "/api/ems/quote",
  "/api/ems/exchange-rate",
  "/api/ems/nations",
  "/api/eximbay",
  "/api/portone",
  "/api/inicis",
  "/api/shop",
];

/** IP별 요청 카운터 (서버리스 인스턴스 내 기본 방어) */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_API = 60;    // API: 1분에 60회
const RATE_LIMIT_WINDOW = 60_000; // 1분

function checkRateLimit(ip: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ??       // Cloudflare 실제 IP
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_PATHS.some(
    (p) => p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const ip = getClientIp(request);

  // API 경로에 Rate Limiting 적용
  if (pathname.startsWith("/api/")) {
    if (!checkRateLimit(ip, RATE_LIMIT_API)) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = isPublicPath(pathname);

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup" || pathname.startsWith("/login/") || pathname.startsWith("/signup/"))) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
};
