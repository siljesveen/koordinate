/** Dev-only API og verktøy — blokkeres i produksjon og preview på Vercel. */
export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === "development";
}
