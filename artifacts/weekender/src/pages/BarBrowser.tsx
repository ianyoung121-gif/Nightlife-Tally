import { useState, useMemo } from "react";
import { useListBars } from "@workspace/api-client-react";
import { BarCard } from "@/components/BarCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Loader2, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "@/hooks/use-debounce";
import { useUserLocation, distanceMiles, hasVerifiedVenueLocation } from "@/hooks/useUserLocation";

export function BarBrowser() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [sortByDistance, setSortByDistance] = useState(false);

  const { data: bars, isLoading } = useListBars(
    debouncedSearch ? { search: debouncedSearch } : undefined
  );

  const { state: locState, request: requestLocation } = useUserLocation();

  const handleNearMe = () => {
    if (locState.status === "idle" || locState.status === "denied") {
      requestLocation();
    }
    setSortByDistance(true);
  };

  const sortedBars = useMemo(() => {
    if (!bars) return bars;
    if (
      sortByDistance &&
      locState.status === "granted" &&
      bars.some(hasVerifiedVenueLocation)
    ) {
      const { latitude: uLat, longitude: uLng } = locState.location;
      return [...bars].sort((a, b) => {
        const dA =
          hasVerifiedVenueLocation(a)
            ? distanceMiles(uLat, uLng, a.latitude, a.longitude)
            : Infinity;
        const dB =
          hasVerifiedVenueLocation(b)
            ? distanceMiles(uLat, uLng, b.latitude, b.longitude)
            : Infinity;
        return dA - dB;
      });
    }
    return bars;
  }, [bars, sortByDistance, locState]);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  const locationLabel = () => {
    if (locState.status === "loading") return <><Loader2 className="w-4 h-4 animate-spin" /> Locating…</>;
    if (locState.status === "granted" && sortByDistance) return <><Navigation className="w-4 h-4" /> Near Me ✓</>;
    return <><MapPin className="w-4 h-4" /> Near Me</>;
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
            Directory
          </h1>
          <p className="text-muted-foreground font-mono mt-2">
            Every spot in town. Find where you belong tonight.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Near Me toggle */}
          <Button
            variant={sortByDistance && locState.status === "granted" ? "default" : "outline"}
            onClick={handleNearMe}
            disabled={locState.status === "loading"}
            className={`h-12 font-mono text-sm gap-2 shrink-0 ${
              sortByDistance && locState.status === "granted"
                ? "bg-accent text-black hover:bg-accent/90 border-accent shadow-[0_0_12px_rgba(0,229,255,0.4)]"
                : "border-border/50 text-muted-foreground hover:text-white hover:border-accent/50"
            }`}
          >
            {locationLabel()}
          </Button>
          {sortByDistance && locState.status === "granted" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortByDistance(false)}
              className="text-xs text-muted-foreground hover:text-white h-12 sm:h-auto"
            >
              Clear
            </Button>
          )}

          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bars by name..."
              className="pl-10 bg-card border-border/50 focus-visible:ring-primary h-12 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Location denied notice */}
      <AnimatePresence>
        {locState.status === "denied" && sortByDistance && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center gap-3"
          >
            <MapPin className="w-4 h-4 text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-300 font-mono">
              Location access was denied. Enable it in your browser settings to sort by distance.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : !sortedBars || sortedBars.length === 0 ? (
        <div className="text-center py-24 bg-card/30 rounded-xl border border-border/50">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold uppercase text-white mb-2">No bars found</h3>
          <p className="text-muted-foreground font-mono">
            We couldn't find anything matching "{search}".
          </p>
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {sortedBars.map((bar) => (
            <motion.div key={bar.id} variants={item}>
              <BarCard
                bar={bar}
                distanceMi={
                  sortByDistance &&
                  locState.status === "granted" &&
                  hasVerifiedVenueLocation(bar)
                    ? distanceMiles(
                        locState.location.latitude,
                        locState.location.longitude,
                        bar.latitude,
                        bar.longitude
                      )
                    : undefined
                }
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
