import { byggInfoskjermFraSky, erGyldigInfoskjermToken } from "@/lib/data/skjermDataLoader";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!erGyldigInfoskjermToken(token)) {
    return NextResponse.json({ error: "Ugyldig token" }, { status: 401 });
  }

  const dato = searchParams.get("dato") ?? undefined;
  const result = await byggInfoskjermFraSky(dato);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json(result.data, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
