import { NextResponse } from "next/server";

/** Eldre e-postmaler peker hit — videresend til manuell aktivering uten å bruke token. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const url = new URL(`${origin}/auth/aktiver`);
  for (const [key, value] of searchParams.entries()) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url.toString());
}
