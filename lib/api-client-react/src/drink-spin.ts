import type { PublicSpecial, Special } from "./generated/api.schemas";

export interface SpinDrinkChoice {
  id: string;
  name: string;
  description: string;
  kind: "common-drink" | "owner-special" | "checked-special";
  barId?: number;
  providerId?: string;
  sourceUrl?: string;
  checkedAt?: string;
  expiresAt?: string;
}

// A curated selection, not a measured popularity ranking or a venue's menu.
export const COMMON_BAR_DRINKS: readonly SpinDrinkChoice[] = [
  { id: "margarita", name: "Margarita", description: "Tequila, lime, and orange liqueur.", kind: "common-drink" },
  { id: "old-fashioned", name: "Old Fashioned", description: "Whiskey, bitters, and sugar.", kind: "common-drink" },
  { id: "gin-tonic", name: "Gin & Tonic", description: "Gin and tonic water, usually with a citrus garnish.", kind: "common-drink" },
  { id: "vodka-soda", name: "Vodka Soda", description: "Vodka and soda water, often served with lime.", kind: "common-drink" },
  { id: "rum-coke", name: "Rum & Coke", description: "Rum and cola over ice.", kind: "common-drink" },
  { id: "moscow-mule", name: "Moscow Mule", description: "Vodka, ginger beer, and lime.", kind: "common-drink" },
  { id: "mojito", name: "Mojito", description: "Rum, mint, lime, sugar, and soda water.", kind: "common-drink" },
  { id: "whiskey-sour", name: "Whiskey Sour", description: "Whiskey, lemon, and sugar; some versions include egg white.", kind: "common-drink" },
  { id: "martini", name: "Martini", description: "Gin or vodka with dry vermouth.", kind: "common-drink" },
  { id: "espresso-martini", name: "Espresso Martini", description: "Vodka, coffee liqueur, and espresso.", kind: "common-drink" },
  { id: "manhattan", name: "Manhattan", description: "Whiskey, sweet vermouth, and bitters.", kind: "common-drink" },
  { id: "cosmopolitan", name: "Cosmopolitan", description: "Vodka, orange liqueur, cranberry, and lime.", kind: "common-drink" },
  { id: "negroni", name: "Negroni", description: "Gin, Campari, and sweet vermouth.", kind: "common-drink" },
  { id: "paloma", name: "Paloma", description: "Tequila, grapefruit soda, and lime.", kind: "common-drink" },
  { id: "aperol-spritz", name: "Aperol Spritz", description: "Aperol, prosecco, and soda water.", kind: "common-drink" },
  { id: "daiquiri", name: "Daiquiri", description: "Rum, lime, and sugar, traditionally shaken.", kind: "common-drink" },
  { id: "tom-collins", name: "Tom Collins", description: "Gin, lemon, sugar, and soda water.", kind: "common-drink" },
  { id: "draft-beer", name: "Draft Beer", description: "Ask the bartender what is currently on tap.", kind: "common-drink" },
  { id: "red-wine", name: "Red Wine", description: "Ask about the available red wines by the glass.", kind: "common-drink" },
  { id: "white-wine", name: "White Wine", description: "Ask about the available white wines by the glass.", kind: "common-drink" },
];

function offerIsCurrent(value: string | null | undefined, now: number): boolean {
  if (!value) return true; // An owner can explicitly post an ongoing special.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Owner date-only offers run through the end of the device's local day,
    // not UTC midnight at the start of that day.
    const [year, month, day] = value.split("-").map(Number);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    if (end.getFullYear() !== year || end.getMonth() !== month - 1 || end.getDate() !== day) return false;
    return end.getTime() > now;
  }
  const expiry = Date.parse(value);
  return Number.isFinite(expiry) && expiry > now;
}

export function isSpinChoiceCurrent(choice: SpinDrinkChoice, now: number = Date.now()): boolean {
  if (choice.kind === "common-drink") return true;
  if (choice.kind === "checked-special" && !choice.expiresAt) return false;
  return offerIsCurrent(choice.expiresAt, now);
}

export function getCurrentSpecialChoices(
  ownerSpecials: readonly Special[],
  checkedSpecials: readonly PublicSpecial[],
  now: number = Date.now(),
): SpinDrinkChoice[] {
  const owner: SpinDrinkChoice[] = ownerSpecials
    .filter((s) => s.title.trim() && offerIsCurrent(s.validUntil, now))
    .map((s) => ({
      id: `owner-special:${s.id}`,
      name: s.title,
      description: s.description ?? "",
      kind: "owner-special",
      barId: s.barId,
      expiresAt: s.validUntil ?? undefined,
    }));
  const checked: SpinDrinkChoice[] = checkedSpecials
    .filter((s) => s.title.trim() && !!s.expiresAt && offerIsCurrent(s.expiresAt, now))
    .map((s) => ({
      id: `checked-special:${s.id}`,
      name: s.title,
      description: s.description,
      kind: "checked-special",
      barId: s.barId ?? undefined,
      providerId: s.providerId ?? undefined,
      sourceUrl: s.sourceUrl,
      checkedAt: s.checkedAt,
      expiresAt: s.expiresAt,
    }));
  return [...owner, ...checked];
}
