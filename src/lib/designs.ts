export const DESIGN_STORAGE_KEY = "tabletalk-design";

export const DESIGNS = [
  { id: "club", homeLayout: "cards", statsLayout: "bars", scorerLayout: "paired", label: "Club", description: "Compact navy clubhouse", swatches: ["#14232e", "#89c7eb", "#f1b585"] },
  { id: "paper", homeLayout: "list", statsLayout: "table", scorerLayout: "rows", label: "Paper", description: "White editorial match ledger", swatches: ["#ffffff", "#24282b", "#376b91"] },
  { id: "pitch", homeLayout: "pitch", statsLayout: "field", scorerLayout: "pitch", label: "Pitch", description: "Green playing field and bright score rails", swatches: ["#124b38", "#f3f9d8", "#ffd579"] },
  { id: "mono", homeLayout: "table", statsLayout: "table", scorerLayout: "grid", label: "Mono", description: "Black and white utility grid", swatches: ["#ffffff", "#121212", "#767676"] },
  { id: "arcade", homeLayout: "versus", statsLayout: "stacked", scorerLayout: "grid", label: "Arcade", description: "Violet cabinet and digital counters", swatches: ["#191429", "#7ce5ed", "#eab1ff"] },
  { id: "clay", homeLayout: "tickets", statsLayout: "table", scorerLayout: "paired", label: "Clay", description: "Warm café table and rounded counters", swatches: ["#f5e9d6", "#573a2b", "#a64227"] },
  { id: "blueprint", homeLayout: "matrix", statsLayout: "table", scorerLayout: "rows", label: "Blueprint", description: "Blue table plan with precise ruled panels", swatches: ["#123c68", "#e9f6ff", "#9bdbff"] },
  { id: "coral", homeLayout: "tiles", statsLayout: "donut", scorerLayout: "grid", label: "Coral", description: "Coral and teal with pill controls", swatches: ["#fffcf9", "#b73539", "#006d6a"] },
  { id: "stadium", homeLayout: "broadcast", statsLayout: "stacked", scorerLayout: "broadcast", label: "Stadium", description: "Compact navy and red broadcast scorebar", swatches: ["#101a2a", "#f0f3f8", "#ff8a8a"] },
  { id: "forest", homeLayout: "list", statsLayout: "bars", scorerLayout: "rows", label: "Forest", description: "Quiet green flat table dashboard", swatches: ["#f5f7f1", "#245b46", "#8b5627"] },
] as const;

export type DesignId = (typeof DESIGNS)[number]["id"];

export function isDesignId(value: string | null | undefined): value is DesignId {
  return DESIGNS.some((design) => design.id === value);
}

export function resolveDesign(requested?: string | null, saved?: string | null): DesignId {
  return isDesignId(requested) ? requested : isDesignId(saved) ? saved : "club";
}

export function designSearch(search: string, design: DesignId): string {
  const params = new URLSearchParams(search);
  params.set("design", design);
  return `?${params.toString()}`;
}

export function readSavedDesign(): DesignId {
  try {
    return resolveDesign(null, localStorage.getItem(DESIGN_STORAGE_KEY));
  } catch {
    return "club";
  }
}
