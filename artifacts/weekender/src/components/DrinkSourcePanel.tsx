import { useEffect, useMemo, useState } from "react";
import {
  COMMON_BAR_DRINKS,
  getCurrentSpecialChoices,
  isSpinChoiceCurrent,
  getGetPublicVenueQueryKey,
  getListBarSpecialsQueryKey,
  getListPublicSpecialsQueryKey,
  useGetPublicVenue,
  useListBarSpecials,
  useListBars,
  useListPublicSpecials,
  type SpinDrinkChoice,
} from "@workspace/api-client-react";
import { RouletteWheel } from "@/components/RouletteWheel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { ExternalLink, MapPin, RotateCcw } from "lucide-react";

type Source = "specials" | "random";

const fmt = (iso?: string) => {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T00:00:00`).toLocaleDateString();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

function ChoiceResult({ choice, random }: { choice: SpinDrinkChoice; random: boolean }) {
  const checked = !random && !!choice.sourceUrl;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="rounded-2xl border-2 border-primary/50 bg-primary/10 p-6 text-center space-y-2"
      data-testid="result-drink-choice"
    >
      <p className="text-xs font-mono text-primary uppercase tracking-widest">
        {random ? "Random suggestion" : checked ? "Checked public special" : "Posted by the venue"}
      </p>
      <h3 className="text-3xl font-black uppercase tracking-tighter text-white">{choice.name}</h3>
      {choice.description && <p className="text-muted-foreground text-sm leading-relaxed">{choice.description}</p>}
      {random && (
        <p className="text-[11px] font-mono text-muted-foreground">
          A general idea only. Not a claim that any bar stocks it, and not a popularity ranking.
        </p>
      )}
      {checked && (
        <div className="text-[11px] font-mono text-muted-foreground space-y-1">
          {choice.checkedAt && <p>Checked {fmt(choice.checkedAt)}</p>}
          {choice.expiresAt && <p>Expires {fmt(choice.expiresAt)}</p>}
          <a
            href={choice.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-accent hover:underline"
            data-testid="link-special-source"
          >
            <ExternalLink className="w-3 h-3" /> View source
          </a>
        </div>
      )}
      {!random && !checked && choice.expiresAt && (
        <p className="text-[11px] font-mono text-muted-foreground">Valid until {fmt(choice.expiresAt)}</p>
      )}
    </motion.div>
  );
}

// Keyed by the offer pool so result and wheel reset whenever the pool changes.
function ChoiceWheel({
  choices,
  random,
  onSpinningChange,
  onExpired,
}: {
  choices: readonly SpinDrinkChoice[];
  random: boolean;
  onSpinningChange: (s: boolean) => void;
  onExpired: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const items = useMemo(() => choices.map((c) => ({ label: c.name })), [choices]);
  const choice = picked !== null ? choices[picked] : null;
  return (
    <div className="space-y-6">
      <RouletteWheel
        items={items}
        accentColor="#FF2D78"
        spinLabel={random ? "Spin a random drink" : "Spin the specials"}
        onSpinningChange={onSpinningChange}
        onResult={(index) => {
          if (choices[index] && isSpinChoiceCurrent(choices[index])) setPicked(index);
          else onExpired();
        }}
      />
      {choice && <ChoiceResult choice={choice} random={random} />}
    </div>
  );
}

export function DrinkSourcePanel({
  initialBarId,
  initialProviderId,
}: {
  initialBarId?: number;
  initialProviderId?: string;
}) {
  const hasContext = initialBarId !== undefined || !!initialProviderId;
  const [source, setSource] = useState<Source>(hasContext ? "specials" : "random");
  const initialSel = initialBarId !== undefined ? `bar:${initialBarId}` : initialProviderId ? `place:${initialProviderId}` : "";
  const [sel, setSel] = useState(initialSel);
  const [spinning, setSpinning] = useState(false);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setSel(initialSel);
    if (initialSel) setSource("specials");
  }, [initialSel]);

  const barsQ = useListBars({});
  const barId = sel.startsWith("bar:") ? Number(sel.slice(4)) : undefined;
  const providerId = sel.startsWith("place:") ? sel.slice(6) : undefined;
  const contextProviderId = initialProviderId || providerId;

  const venueQ = useGetPublicVenue(contextProviderId ?? "", {
    query: { enabled: !!contextProviderId, queryKey: getGetPublicVenueQueryKey(contextProviderId ?? "") },
  });
  const linkedBarId = providerId && contextProviderId === providerId ? venueQ.data?.linkedBarId ?? undefined : undefined;
  const ownerBarId = barId ?? linkedBarId;
  const ownerQ = useListBarSpecials(ownerBarId ?? 0, {
    query: { enabled: source === "specials" && ownerBarId !== undefined, refetchInterval: 30_000, queryKey: getListBarSpecialsQueryKey(ownerBarId ?? 0) },
  });
  const pubParams = barId !== undefined ? { barId } : { providerId: providerId ?? "" };
  const publicQ = useListPublicSpecials(pubParams, {
    query: { enabled: source === "specials" && sel !== "", refetchInterval: 30_000, queryKey: getListPublicSpecialsQueryKey(pubParams) },
  });

  const bar = barId !== undefined ? barsQ.data?.find((b) => b.id === barId) : undefined;
  const venueName = barId !== undefined ? bar?.name : venueQ.data?.name;
  const venueAddress = barId !== undefined ? bar?.address : venueQ.data?.address;

  const specialChoices = useMemo(
    () => (sel ? getCurrentSpecialChoices(ownerQ.data ?? [], publicQ.data ?? [], now) : []),
    [sel, ownerQ.data, publicQ.data, now],
  );

  const loading = sel !== "" && ((barId !== undefined && (ownerQ.isLoading || barsQ.isLoading)) || (providerId !== undefined && (venueQ.isLoading || (linkedBarId !== undefined && ownerQ.isLoading))) || publicQ.isLoading);
  const failed = sel !== "" && ((barId !== undefined && (ownerQ.isError || barsQ.isError)) || (providerId !== undefined && (venueQ.isError || (linkedBarId !== undefined && ownerQ.isError))) || publicQ.isError);
  const retry = () => {
    if (barId !== undefined) void barsQ.refetch();
    if (providerId) void venueQ.refetch();
    if (ownerBarId !== undefined) void ownerQ.refetch();
    void publicQ.refetch();
  };

  const poolKey = `${source}|${sel}|${(source === "random" ? COMMON_BAR_DRINKS : specialChoices).map((c) => c.id).join(",")}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 rounded-xl border border-border/50 bg-muted/30 p-1 gap-1" role="tablist">
        {([["specials", "Bar specials"], ["random", "Random drink"]] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={source === id}
            disabled={spinning}
            data-testid={`tab-drink-${id}`}
            onClick={() => setSource(id)}
            className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-50 ${
              source === id ? "bg-primary text-white" : "text-muted-foreground hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {source === "random" ? (
        <div className="space-y-4">
          <p className="text-center text-xs font-mono text-muted-foreground">
            20 common bar drinks. Suggestions only: no venue needed, nothing stored, no guarantee any bar serves them.
          </p>
          <ChoiceWheel key={poolKey} choices={COMMON_BAR_DRINKS} random onSpinningChange={setSpinning} onExpired={() => setNow(Date.now())} />
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Venue</span>
            <select
              value={sel}
              disabled={spinning}
              onChange={(e) => setSel(e.target.value)}
              data-testid="select-spin-venue"
              className="w-full rounded-lg border border-border/50 bg-card px-3 py-2.5 text-sm text-white disabled:opacity-50"
            >
              <option value="">Choose a venue</option>
              {contextProviderId && <option value={`place:${contextProviderId}`}>{venueQ.data?.name ?? "Google Maps place"} (Google place)</option>}
              {(barsQ.data ?? []).map((b) => (
                <option key={b.id} value={`bar:${b.id}`}>
                  {b.name}{b.address ? ` - ${b.address}` : ""}
                </option>
              ))}
            </select>
          </label>
          {barsQ.isError && (
            <p className="text-xs font-mono text-destructive">
              Could not load venues. <button className="underline" onClick={() => void barsQ.refetch()}>Retry</button>
            </p>
          )}

          {sel === "" ? (
            <div className="text-center py-12 text-muted-foreground font-mono text-sm">
              Pick the exact venue to see its current specials.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border/50 bg-card p-4">
                <p className="font-black uppercase tracking-tight text-white">{venueName ?? "Loading venue"}</p>
                {venueAddress && (
                  <p className="text-xs font-mono text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {venueAddress}
                  </p>
                )}
                {providerId && (
                  <p className="text-[11px] font-mono text-muted-foreground mt-2">
                    {linkedBarId !== undefined
                      ? "Google Maps place linked to a verified Weekender owner. Current owner specials and checked public specials can appear; Google does not supply specials."
                      : "Google Maps place: only checked public specials can appear. No owner is linked."}
                  </p>
                )}
              </div>
              {loading ? (
                <div className="space-y-3" data-testid="loading-specials">
                  <Skeleton className="h-56 w-56 rounded-full mx-auto" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : failed ? (
                <div className="text-center py-10 space-y-3" data-testid="error-specials">
                  <p className="text-sm font-mono text-muted-foreground">Could not load this venue's specials.</p>
                  <Button variant="outline" onClick={retry} data-testid="button-retry-specials">
                    <RotateCcw className="w-4 h-4 mr-2" /> Try again
                  </Button>
                </div>
              ) : specialChoices.length === 0 ? (
                <div className="text-center py-10 text-sm font-mono text-muted-foreground" data-testid="empty-specials">
                  No current specials found for this venue. Try Random drink for a general idea instead.
                </div>
              ) : (
                <ChoiceWheel key={poolKey} choices={specialChoices} random={false} onSpinningChange={setSpinning} onExpired={() => setNow(Date.now())} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
