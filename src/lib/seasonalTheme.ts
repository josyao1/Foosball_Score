export type SeasonalTheme = "thanksgiving" | "christmas";

// One-off 2026 season, using the league's Pacific time rather than device timezone.
export function scheduledSeason(now: number): SeasonalTheme | null {
  if (now >= Date.parse("2026-11-16T00:00:00-08:00") && now < Date.parse("2026-12-01T00:00:00-08:00")) return "thanksgiving";
  if (now >= Date.parse("2026-12-01T00:00:00-08:00") && now < Date.parse("2027-01-01T00:00:00-08:00")) return "christmas";
  return null;
}

export function seasonalPreview(development: boolean, search: string): SeasonalTheme | "auto" | undefined {
  if (!development) return undefined;
  const requested = new URLSearchParams(search).get("season");
  return requested === "thanksgiving" || requested === "auto" ? requested : "christmas";
}
