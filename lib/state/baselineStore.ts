export const BASELINE_KEY = "bemanning.baseline.v1";
export const ALIAS_MAP_KEY = "bemanning.aliasmap.v1";

export type AliasMap = Record<string, string>; // sjåførtekst -> ansattId

export function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

