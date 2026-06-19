import { getAppOrigin } from "./appUrl";

export type AktiverLenkeType = "invite" | "recovery" | "signup" | "magiclink" | "email";

/** Lenke til manuell aktivering — unngår at Outlook «bruker» lenken automatisk. */
export function byggAktiverLenkeUrl(args: {
  token_hash: string;
  type: AktiverLenkeType;
  next?: string;
}): string {
  const next = encodeURIComponent(args.next ?? "/auth/sett-passord");
  const token = encodeURIComponent(args.token_hash);
  return `${getAppOrigin()}/auth/aktiver?token_hash=${token}&type=${args.type}&next=${next}`;
}
