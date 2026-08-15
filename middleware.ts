import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDualAuthEnforced, isDualAuthSatisfied } from "@/lib/auth/dualAuthEdge";
import { isRecoverySession } from "@/lib/auth/recoverySession";

/**
 * Copy refreshed auth cookies from the Supabase response onto any alternate response.
 * Without this, refresh-token rotation leaves the browser on a revoked token and the
 * user appears logged out on the next open.
 */
function withSupabaseCookies(from: NextResponse, to: NextResponse): NextResponse {
  // Prefer full Set-Cookie headers so path / httpOnly / maxAge / sameSite survive.
  const setCookies =
    typeof from.headers.getSetCookie === "function" ? from.headers.getSetCookie() : [];
  if (setCookies.length > 0) {
    for (const cookie of setCookies) {
      to.headers.append("Set-Cookie", cookie);
    }
    return to;
  }
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value);
  });
  return to;
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, skip middleware entirely (demo mode)
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired (may write new cookies onto supabaseResponse)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pendingPasswordRecovery = isRecoverySession(session);

  const pathname = request.nextUrl.pathname;

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/list-share");

  const isPublicApi =
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/invite/") ||
    pathname.startsWith("/api/list-share/") ||
    pathname === "/api/profile/check-username";

  /** PWA + static assets must stay reachable before sign-in (manifest, SW, icons). */
  const isPublicAsset =
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.svg" ||
    pathname.startsWith("/icon-");

  // Exact-match sensitive auth routes so "/api/auth/login-activity" is NOT exempt.
  // Password change requires dual-auth when dual-auth is enforced (stolen session hardening).
  const isDualAuthExemptApi =
    pathname.startsWith("/api/auth/dual-auth") ||
    pathname === "/api/auth/login" ||
    pathname.startsWith("/api/auth/login/") ||
    pathname.startsWith("/api/auth/signup") ||
    pathname.startsWith("/api/auth/resend-verification") ||
    pathname.startsWith("/api/auth/reset-password") ||
    pathname.startsWith("/api/webhooks/brevo-inbound") ||
    pathname.startsWith("/api/invite/") ||
    pathname.startsWith("/api/list-share/");

  // Block paused users (platform admin can pause accounts)
  if (user && !isAuthPage) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("access_paused")
        .eq("id", user.id)
        .maybeSingle();

      if ((profile as { access_paused?: boolean } | null)?.access_paused) {
        if (pathname.startsWith("/api/")) {
          return withSupabaseCookies(
            supabaseResponse,
            NextResponse.json({ error: "Account paused" }, { status: 403 }),
          );
        }
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.searchParams.set("paused", "1");
        const redirect = NextResponse.redirect(url);
        await supabase.auth.signOut();
        // signOut may clear cookies onto supabaseResponse — copy those clears through.
        return withSupabaseCookies(supabaseResponse, redirect);
      }
    } catch {
      // Column may not exist until migration runs — ignore gracefully
    }
  }

  // Require dual authentication for live API access (email OTP + optional trusted device)
  if (
    user &&
    isDualAuthEnforced() &&
    pathname.startsWith("/api/") &&
    !isDualAuthExemptApi &&
    !(await isDualAuthSatisfied(request, user.id))
  ) {
    return withSupabaseCookies(
      supabaseResponse,
      NextResponse.json({ error: "dual_auth_required" }, { status: 403 }),
    );
  }

  // Recovery sessions must finish setting a new password before using the app
  if (user && pendingPasswordRecovery && !isAuthPage) {
    const recoveryLogin = new URL("/login", request.url);
    recoveryLogin.searchParams.set("mode", "reset-verify");
    return withSupabaseCookies(
      supabaseResponse,
      NextResponse.redirect(recoveryLogin),
    );
  }

  // Signed-in users should not linger on the login page (except unfinished password recovery)
  if (user && pathname.startsWith("/login") && !pendingPasswordRecovery) {
    const nextParam = request.nextUrl.searchParams.get("next");
    const destination =
      nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
    return withSupabaseCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(destination, request.url)),
    );
  }

  // Unauthenticated API calls → JSON 401 (never HTML redirect)
  if (!user && pathname.startsWith("/api/") && !isPublicApi) {
    return withSupabaseCookies(
      supabaseResponse,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  // Production: redirect unauthenticated users away from protected pages
  if (
    process.env.NODE_ENV === "production" &&
    !user &&
    !isAuthPage &&
    !isPublicAsset &&
    pathname !== "/" &&
    !pathname.startsWith("/api/")
  ) {
    const signInUrl = new URL("/login", request.url);
    const returnPath = `${pathname}${request.nextUrl.search}`;
    if (returnPath && returnPath !== "/") {
      signInUrl.searchParams.set("next", returnPath);
    }
    return withSupabaseCookies(
      supabaseResponse,
      NextResponse.redirect(signInUrl),
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
