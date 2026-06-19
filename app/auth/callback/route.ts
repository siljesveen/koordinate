import { tryggRedirectPath } from "@/lib/auth/tryggRedirectPath";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const STANDARD_NEXT = "/auth/sett-passord";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = tryggRedirectPath(searchParams.get("next") ?? STANDARD_NEXT);

  if (token_hash && type) {
    const url = new URL(`${origin}/auth/aktiver`);
    url.searchParams.set("token_hash", token_hash);
    url.searchParams.set("type", type);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url.toString());
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
