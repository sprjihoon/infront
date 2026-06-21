import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { accessToken, email, name, profileImage, naverId } =
      await req.json();

    if (!accessToken || !naverId) {
      return new Response(
        JSON.stringify({ error: "accessToken and naverId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 네이버 ID로 기존 유저 조회 (user_metadata.naver_id 로 매핑)
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.user_metadata?.naver_id === naverId
    );

    let userId: string;

    if (existingUser) {
      // 기존 유저: 정보 업데이트
      userId = existingUser.id;
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          naver_id: naverId,
          name,
          avatar_url: profileImage,
          provider: "naver",
        },
      });
    } else {
      // 신규 유저 생성
      const { data: newUser, error: createError } =
        await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            naver_id: naverId,
            name,
            avatar_url: profileImage,
            provider: "naver",
          },
          app_metadata: { provider: "naver", providers: ["naver"] },
        });

      if (createError) {
        // 이메일 중복이면 해당 유저를 찾아서 연결
        if (createError.message?.includes("already been registered")) {
          const { data: found } = await admin
            .from("auth.users")
            .select("id")
            .eq("email", email)
            .single();

          if (found) {
            userId = found.id;
            await admin.auth.admin.updateUserById(userId, {
              user_metadata: {
                naver_id: naverId,
                name,
                avatar_url: profileImage,
                provider: "naver",
              },
            });
          } else {
            throw new Error(createError.message);
          }
        } else {
          throw new Error(createError.message);
        }
      } else {
        userId = newUser.user!.id;
      }
    }

    // 세션 생성 (magic link 방식으로 sign-in link → token 추출)
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${supabaseUrl}/auth/v1/callback` },
      });

    if (linkError) {
      throw new Error(linkError.message);
    }

    // hashed_token 을 exchangeCodeForSession 과 유사하게 처리
    // properties.hashed_token 으로 access_token / refresh_token 취득
    const tokenHash = linkData.properties?.hashed_token;
    if (!tokenHash) {
      throw new Error("Failed to generate session token");
    }

    const verifyRes = await fetch(
      `${supabaseUrl}/auth/v1/verify?token=${tokenHash}&type=magiclink`,
      {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        redirect: "manual",
      }
    );

    // Location 헤더에서 access_token, refresh_token 파싱
    const location = verifyRes.headers.get("location") || "";
    const fragment = location.split("#")[1] || "";
    const params = new URLSearchParams(fragment);
    const sessionAccessToken = params.get("access_token");
    const sessionRefreshToken = params.get("refresh_token");

    if (!sessionAccessToken || !sessionRefreshToken) {
      throw new Error("Failed to extract session tokens");
    }

    return new Response(
      JSON.stringify({
        access_token: sessionAccessToken,
        refresh_token: sessionRefreshToken,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[naver-auth]", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
