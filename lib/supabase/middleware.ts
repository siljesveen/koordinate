import { tryggRedirectPath } from "@/lib/auth/tryggRedirectPath";
import { canAccessPath } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/auth/types";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "./env";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/auth/confirm",
  "/auth/sett-passord",
  "/skjerm",
  "/api/skjerm",
];

function erSupabaseAuthCookie(navn: string): boolean {
  return navn.startsWith("sb-") && navn.includes("auth-token");
}

function fjernSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
): void {
  for (const cookie of request.cookies.getAll()) {
    if (erSupabaseAuthCookie(cookie.name)) {
      response.cookies.delete(cookie.name);
    }
  }
}

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
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
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  let user: { id: string } | null = null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      try {
        await supabase.auth.signOut();
      } catch {
        fjernSupabaseAuthCookies(request, supabaseResponse);
      }
    } else {
      user = data.user;
    }
  } catch {
    // Nettverksfeil mot Supabase — behandle som utlogget, ikke krasj middleware.
    user = null;
  }

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    const redirect = NextResponse.redirect(url);
    fjernSupabaseAuthCookies(request, redirect);
    return redirect;
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = tryggRedirectPath(request.nextUrl.searchParams.get("next"));
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    let role: AppRole = "visning";
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role === "admin" || profile?.role === "planlegger" || profile?.role === "visning") {
        role = profile.role;
      }
    } catch {
      // Nettverksfeil — fall tilbake til minst tilgang.
    }

    if (!canAccessPath(role, path)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
