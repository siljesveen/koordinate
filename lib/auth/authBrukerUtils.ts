import type { User } from "@supabase/supabase-js";

export function visningsnavnFraAuthBruker(user: Pick<User, "email" | "user_metadata">): string {
  const meta = user.user_metadata ?? {};
  const kandidater = [meta.display_name, meta.full_name, meta.name];
  for (const k of kandidater) {
    if (typeof k === "string" && k.trim()) return k.trim();
  }
  const email = user.email ?? "";
  const lokalt = email.split("@")[0]?.trim();
  return lokalt || "Bruker";
}

export async function listAlleAuthBrukere(
  listUsers: (page: number, perPage: number) => Promise<{ users: User[]; error: Error | null }>,
): Promise<User[]> {
  const brukere: User[] = [];
  const perPage = 200;
  let page = 1;

  while (true) {
    const { users, error } = await listUsers(page, perPage);
    if (error) throw error;
    brukere.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }

  return brukere;
}
