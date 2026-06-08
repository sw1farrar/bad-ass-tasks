import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDualAuthEnforced, isDualAuthSatisfied } from "@/lib/auth/dualAuthEdge";

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

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/invite");

  const isPublicApi =
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/invite/") ||
    pathname === "/api/profile/check-username";

  const isDualAuthExemptApi =
    pathname.startsWith("/api/auth/dual-auth") ||
    pathname.startsWith("/api/auth/signup") ||
    pathname.startsWith("/api/auth/resend-verification") ||
    pathname.startsWith("/api/webhooks/brevo-inbound") ||
    pathname.startsWith("/api/invite/");

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
          return NextResponse.json({ error: "Account paused" }, { status: 403 });
        }
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.searchParams.set("paused", "1");
        const redirect = NextResponse.redirect(url);
        await supabase.auth.signOut();
        return redirect;
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
    return NextResponse.json({ error: "dual_auth_required" }, { status: 403 });
  }

  // Unauthenticated API calls → JSON 401 (never HTML redirect)
  if (!user && pathname.startsWith("/api/") && !isPublicApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Production: redirect unauthenticated users away from protected pages
  if (
    process.env.NODE_ENV === "production" &&
    !user &&
    !isAuthPage &&
    pathname !== "/" &&
    !pathname.startsWith("/api/")
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
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
