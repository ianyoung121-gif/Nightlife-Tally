import { useState } from "react";
import { useListBars, useGetTrendingDrinks } from "@workspace/api-client-react";
import { RouletteWheel } from "@/components/RouletteWheel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, MapPin, Dices, RotateCcw, Shuffle, ArrowRight, Star } from "lucide-react";

// ─── Static data ────────────────────────────────────────────────────────────

const DARES = [
  "Order whatever the bartender recommends — no questions asked 🎲",
  "Everyone in the group orders something they've never tried before 👀",
  "Leave a 5-star review from inside the bar 📱",
  "Make a toast that includes everyone's name before the first sip 🥂",
  "Order 'something purple' and see what the bartender does 💜",
  "Tip 25% if your drink slaps — spread the love 💸",
  "Convince a stranger to tell you the best bar they've ever been to 🗺️",
  "Find out the bar's signature cocktail, then order it for someone else 🍸",
  "Order the most expensive drink on the menu and split it as a group 👑",
  "Ask the bartender for the 'off-menu special' and see what happens 🤫",
  "Get a group selfie — at least one bartender has to be in it 📸",
  "Next round: everyone orders using only one adjective to describe what they want 🎭",
  "Order a round of water first. Hydration is part of the mission 💧",
  "Start a group chat with everyone from tonight before you leave this bar 📲",
];

const CRAWL_SLOTS = [
  { name: "First Stop", emoji: "🔥", vibe: "Ease in. Warm up the group.", timeHint: "~9 PM" },
  { name: "Second Stop", emoji: "⚡", vibe: "Peak energy — find your groove.", timeHint: "~10:30 PM" },
  { name: "Last Call", emoji: "🌙", vibe: "Go out with a bang. No regrets.", timeHint: "Midnight →" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomDare() { return DARES[Math.floor(Math.random() * DARES.length)]; }

// ─── Drink Result ──────────────────────────────────────────────────────────
function DrinkResult({ drink }: { drink: { name: string; barName?: string | null; price?: string | null; description?: string | null; barId: number } }) {
  return (
    <motion.div
      key={drink.name}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="relative rounded-2xl border-2 border-primary/50 bg-primary/10 p-6 text-center overflow-hidden shadow-[0_0_30px_rgba(255,45,120,0.3)]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/5 pointer-events-none" />
      <p className="text-xs font-mono text-primary uppercase tracking-widest mb-2">Tonight you're drinking…</p>
      <h3 className="text-3xl font-black uppercase tracking-tighter text-white">{drink.name}</h3>
      {drink.barName && (
        <Link href={`/bars/${drink.barId}`}>
          <p className="text-accent font-mono text-sm mt-2 hover:underline flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3" /> @ {drink.barName}
          </p>
        </Link>
      )}
      {drink.price && <p className="text-muted-foreground text-sm mt-1 font-mono">{drink.price}</p>}
      {drink.description && <p className="text-muted-foreground text-xs mt-2 leading-relaxed">{drink.description}</p>}
    </motion.div>
  );
}

// ─── Bar Result ────────────────────────────────────────────────────────────
function BarResult({ bar }: { bar: { id: number; name: string; address?: string | null; description?: string | null; subscriptionActive?: boolean } }) {
  return (
    <motion.div
      key={bar.name}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="relative rounded-2xl border-2 border-secondary/50 bg-secondary/10 p-6 text-center overflow-hidden shadow-[0_0_30px_rgba(123,47,255,0.3)]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-primary/5 pointer-events-none" />
      <p className="text-xs font-mono text-secondary uppercase tracking-widest mb-2">The night takes you to…</p>
      <h3 className="text-3xl font-black uppercase tracking-tighter text-white">{bar.name}</h3>
      {bar.address && (
        <p className="text-muted-foreground font-mono text-sm mt-2 flex items-center justify-center gap-1">
          <MapPin className="w-3 h-3 text-accent" /> {bar.address}
        </p>
      )}
      {bar.description && <p className="text-muted-foreground text-xs mt-3 leading-relaxed line-clamp-2">{bar.description}</p>}
      {bar.subscriptionActive && (
        <Badge className="mt-3 bg-primary/20 text-primary border-primary/40 text-[10px] font-mono">PRO VENUE</Badge>
      )}
      <Link href={`/bars/${bar.id}`}>
        <Button size="sm" className="mt-4 w-full" variant="secondary">
          View Bar <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </Link>
    </motion.div>
  );
}

// ─── Bar Crawl ──────────────────────────────────────────────────────────────
function BarCrawlTab({ bars }: { bars: Array<{ id: number; name: string; address?: string | null; subscriptionActive?: boolean }> }) {
  const [crawl, setCrawl] = useState<typeof bars | null>(null);
  const [dares, setDares] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const generate = () => {
    if (bars.length < 1) return;
    setGenerating(true);
    setCrawl(null);

    setTimeout(() => {
      const picked = shuffle(bars).slice(0, Math.min(3, bars.length));
      const pickedDares = picked.map(() => randomDare());
      setCrawl(picked);
      setDares(pickedDares);
      setGenerating(false);
    }, 1200);
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3 py-4">
        <div className="text-7xl">🗺️</div>
        <h3 className="text-2xl font-black uppercase tracking-tight text-white">Tonight's Crawl</h3>
        <p className="text-muted-foreground font-mono text-sm max-w-xs mx-auto">
          We'll pick your spots and set the game plan. All you have to do is show up.
        </p>
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={generate}
          disabled={generating || bars.length === 0}
          className="font-black uppercase tracking-widest text-lg h-14 px-10"
          style={{
            background: "linear-gradient(135deg, #FF2D78, #7B2FFF)",
            boxShadow: "0 0 24px rgba(255,45,120,0.4)",
          }}
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <Shuffle className="w-5 h-5 animate-spin" /> Planning the night…
            </span>
          ) : crawl ? (
            <span className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" /> Regenerate Crawl
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Dices className="w-5 h-5" /> Build My Crawl
            </span>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {crawl && !generating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-center gap-2 mb-6">
              <Star className="w-4 h-4 text-primary" />
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Your Itinerary</p>
              <Star className="w-4 h-4 text-primary" />
            </div>

            {crawl.map((bar, i) => {
              const slot = CRAWL_SLOTS[i];
              return (
                <motion.div
                  key={bar.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.18 }}
                  className="relative rounded-2xl border border-border/50 bg-card overflow-hidden"
                >
                  {/* Color bar on left */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5"
                    style={{
                      background: i === 0 ? "#FF2D78" : i === 1 ? "#7B2FFF" : "#00E5FF",
                      boxShadow: `0 0 12px ${i === 0 ? "#FF2D78" : i === 1 ? "#7B2FFF" : "#00E5FF"}`,
                    }}
                  />

                  <div className="pl-5 pr-4 py-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{slot.emoji}</span>
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{slot.name} · {slot.timeHint}</p>
                          <h4 className="text-xl font-black uppercase tracking-tight text-white leading-tight">{bar.name}</h4>
                          {bar.address && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {bar.address}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {bar.subscriptionActive && (
                          <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] font-mono">PRO</Badge>
                        )}
                        <Link href={`/bars/${bar.id}`}>
                          <Button size="sm" variant="outline" className="text-xs h-7">
                            View <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground italic leading-relaxed">
                        {slot.vibe}
                      </p>
                      <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border/50">
                        <p className="text-[10px] font-mono text-accent uppercase tracking-widest mb-1">Stop Dare 🎯</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{dares[i]}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <p className="text-center text-xs text-muted-foreground font-mono pt-2 opacity-60">
              Remember: no drinking and driving. Call a rideshare between stops.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
const TABS = [
  { id: "drink", label: "Drink Roulette", emoji: "🍸" },
  { id: "bar", label: "Bar Roulette", emoji: "🏙️" },
  { id: "crawl", label: "Build My Crawl", emoji: "🗺️" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SpinTheNight() {
  const [activeTab, setActiveTab] = useState<TabId>("drink");
  const [drinkResult, setDrinkResult] = useState<any>(null);
  const [barResult, setBarResult] = useState<any>(null);
  const [dare, setDare] = useState(() => randomDare());

  const { data: drinks } = useGetTrendingDrinks();
  const { data: bars } = useListBars({});

  const drinkWheelItems = (drinks || []).slice(0, 12).map((d) => ({
    label: d.name,
    sublabel: d.barName || undefined,
  }));

  const barWheelItems = (bars || []).slice(0, 12).map((b) => ({
    label: b.name,
    sublabel: b.address || undefined,
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-24">
      {/* Header */}
      <div className="text-center pt-4 space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono uppercase tracking-widest mb-2">
          <Flame className="w-4 h-4" /> Leave it to fate
        </div>
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter text-white">
          Spin the <span className="text-primary drop-shadow-[0_0_15px_rgba(255,45,120,0.8)]">Night</span>
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
          Can't decide? Let the wheel choose. No regrets, only vibes.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-border/50 bg-muted/30 p-1 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wide transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-[0_0_12px_rgba(255,45,120,0.4)]"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <span className="text-base">{tab.emoji}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden text-[10px] leading-tight text-center">{tab.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* ── Drink Tab ── */}
          {activeTab === "drink" && (
            <>
              {drinkWheelItems.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground font-mono">
                  No drinks found. Add some from the Dashboard first.
                </div>
              ) : (
                <RouletteWheel
                  items={drinkWheelItems}
                  accentColor="#FF2D78"
                  spinLabel="🍸 Spin for a Drink"
                  onResult={(_, item) => {
                    const drink = drinks?.find((d) => d.name === item.label);
                    setDrinkResult(drink || { name: item.label, barId: 0 });
                  }}
                />
              )}
              <AnimatePresence>
                {drinkResult && (
                  <DrinkResult drink={drinkResult} />
                )}
              </AnimatePresence>
            </>
          )}

          {/* ── Bar Tab ── */}
          {activeTab === "bar" && (
            <>
              {barWheelItems.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground font-mono">
                  No bars found yet.
                </div>
              ) : (
                <RouletteWheel
                  items={barWheelItems}
                  accentColor="#7B2FFF"
                  spinLabel="🏙️ Spin for a Bar"
                  onResult={(_, item) => {
                    const bar = bars?.find((b) => b.name === item.label);
                    setBarResult(bar || { id: 0, name: item.label });
                  }}
                />
              )}
              <AnimatePresence>
                {barResult && (
                  <BarResult bar={barResult} />
                )}
              </AnimatePresence>
            </>
          )}

          {/* ── Crawl Tab ── */}
          {activeTab === "crawl" && (
            <BarCrawlTab bars={bars || []} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Tonight's Dare ── */}
      <div className="rounded-2xl border border-accent/20 bg-accent/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black uppercase tracking-tight text-accent flex items-center gap-2">
            🎯 Tonight's Dare
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDare(randomDare())}
            className="border-accent/30 text-accent hover:bg-accent/10 text-xs font-mono"
          >
            <RotateCcw className="w-3 h-3 mr-1" /> Next Dare
          </Button>
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={dare}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-white font-semibold text-base leading-relaxed"
          >
            {dare}
          </motion.p>
        </AnimatePresence>
        <p className="text-[10px] font-mono text-muted-foreground mt-3 opacity-60">
          Completing tonight's dare? No obligation — just good vibes.
        </p>
      </div>
    </div>
  );
}
