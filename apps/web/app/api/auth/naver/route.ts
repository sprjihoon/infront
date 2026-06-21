import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { code, redirectUri } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const sanitize = (v: string) => v.replace(/\\r|\\n|\r|\n|"/g, "").trim();
    const rawClientId = process.env.NAVER_CLIENT_ID;
    const rawClientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!rawClientId || !rawClientSecret) {
      return NextResponse.json(
        { error: "Naver OAuth not configured" },
        { status: 500 }
      );
    }

    const clientId = sanitize(rawClientId);
    const clientSecret = sanitize(rawClientSecret);

    // 1. 네이버 토큰 교환
    const tokenRes = await fetch("https://nid.naver.com/oauth2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("[Naver Auth] Token exchange failed:", {
        error: tokenData.error,
        error_description: tokenData.error_description,
      });
      return NextResponse.json(
        {
          error:
            tokenData.error_description ||
            tokenData.error ||
            "Naver token exchange failed",
        },
        { status: 400 }
      );
    }

    // 2. 네이버 사용자 정보 조회
    const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileData = await profileRes.json();
    const profile = profileData.response;

    if (!profile) {
      return NextResponse.json(
        { error: "Failed to get Naver profile" },
        { status: 400 }
      );
    }

    // 3. Supabase Edge Function 호출 (naver-auth)
    const supabase = await createClient();
    const { data: sessionData, error: fnError } =
      await supabase.functions.invoke("naver-auth", {
        body: {
          accessToken: tokenData.access_token,
          email: profile.email || `naver_${profile.id}@naver.infront.kr`,
          name: profile.name || "고객",
          profileImage: profile.profile_image || "",
          naverId: profile.id,
        },
      });

    if (fnError) {
      console.error("[Naver Auth] Edge function error:", fnError);
      return NextResponse.json({ error: fnError.message }, { status: 500 });
    }

    return NextResponse.json(sessionData);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
