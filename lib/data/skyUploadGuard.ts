/** Sjekker at opplasting ikke overskriver nyere eller rikere data i sky. */

const MASTERPLAN_KEY = "bemanning.masterplan.v1";

export type SkyRowSnapshot = {
  key: string;
  value: unknown;
  updatedAt: string;
};

export type UploadBlockReason =
  | "sky_nyere"
  | "tom_lokal"
  | "færre_koblingsgrupper"
  | "ulagrede_lokale_endringer";

export function countKoblingsgrupper(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const grupper = (value as { koblingsgrupper?: unknown }).koblingsgrupper;
  if (!grupper || typeof grupper !== "object" || Array.isArray(grupper)) return 0;
  return Object.keys(grupper).length;
}

export function harMeningsfulltInnhold(key: string, value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object" && "slots" in value) {
    const slots = (value as { slots?: unknown }).slots;
    return Array.isArray(slots) && slots.length > 0;
  }
  if (key === MASTERPLAN_KEY && value && typeof value === "object") {
    return countKoblingsgrupper(value) > 0;
  }
  return value != null && value !== "";
}

export function grunnTilUploadBlokkering(
  key: string,
  local: unknown,
  remote: SkyRowSnapshot | undefined,
  localMeta: string | undefined,
): UploadBlockReason | null {
  if (!remote) return null;

  if (harMeningsfulltInnhold(key, remote.value) && !harMeningsfulltInnhold(key, local)) {
    return "tom_lokal";
  }

  if (localMeta && remote.updatedAt > localMeta) {
    return "sky_nyere";
  }

  if (key === MASTERPLAN_KEY) {
    const localKg = countKoblingsgrupper(local);
    const remoteKg = countKoblingsgrupper(remote.value);
    if (remoteKg > localKg) {
      return "færre_koblingsgrupper";
    }
  }

  return null;
}

export function forklaringBlokkering(reason: UploadBlockReason): string {
  switch (reason) {
    case "sky_nyere":
      return "sky har nyere versjon";
    case "tom_lokal":
      return "lokal data er tom";
    case "færre_koblingsgrupper":
      return "færre koblingsgrupper enn i sky";
    case "ulagrede_lokale_endringer":
      return "ulagrede lokale endringer";
  }
}
