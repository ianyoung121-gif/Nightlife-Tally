import { useState, useMemo } from "react";
import {
  getDiscoverNearbyVenuesQueryKey,
  useDiscoverNearbyVenues,
  useListBars,
} from "@workspace/api-client-react";
import { BarCard } from "@/components/BarCard";
import { LiveVenueCard } from "@/components/LiveVenueCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Loader2, Navigation, Radar } from "lucide-react";
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
  const nearbySearchParams = useMemo(
    () =>
      locState.status === "granted"
        ? {
            latitude: locState.location.latitude,
            longitude: locState.location.longitude,
            radiusMiles: 5,
          }
        : { latitude: 0, longitude: 0, radiusMiles: 5 },
    [locState],
  );
  const nearbyQuery = useDiscoverNearbyVenues(nearbySearchParams, {
    query: {
      queryKey: getDiscoverNearbyVenuesQueryKey(nearbySearchParams),
      enabled: sortByDistance && locState.status === "granted",
      staleTime: 60_000,
      retry: 1,
    },
  });

  const handleNearMe = () => {
    if (locState.status === "idle" || locState.status === "denied") {
      requestLocation();
    }
    setSortByDistance(true);
  };

  const sortedBars = useMemo(() => {
    if (!bars) return bars;
    if (!sortByDistance || locState.status !== "granted") return bars;

    const { latitude: uLat, longitude: uLng } = locState.location;
    return bars
      .filter(hasVerifiedVenueLocation)
      .sort((a, b) => {
        const distanceA = hasVerifiedVenueLocation(a)
          ? distanceMiles(uLat, uLng, a.latitude, a.longitude)
          : Infinity;
        const distanceB = hasVerifiedVenueLocation(b)
          ? distanceMiles(uLat, uLng, b.latitude, b.longitude)
          : Infinity;
        return distanceA - distanceB;
      });
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
    if (locState.status === "granted" && sortByDistance) return <><Navigation className="w-4 h-4" /> Near Me</>;
    return <><MapPin className="w-4 h-4" /> Near Me</>;
  };
  const isNearbyMode = sortByDistance && locState.status === "granted";
  const visibleBars = isNearbyMode && nearbyQuery.data ? nearbyQuery.data.curated : sortedBars;
  const discoveredVenues = isNearbyMode ? nearbyQuery.data?.discovered ?? [] : [];
  const isLoadingDirectory = isLoading || (isNearbyMode && nearbyQuery.isLoading && !nearbyQuery.data);
  const hasAnyVenue = Boolean(visibleBars?.length || discoveredVenues.length);

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
          <p className="text-[11px] text-muted-foreground/70 font-mono mt-2">
            Venue pins are curated with{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-accent"
            >
              OpenStreetMap contributors
            </a>
            .
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

      {isNearbyMode && nearbyQuery.data?.liveSearchStatus === "error" && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center gap-3">
          <Radar className="w-4 h-4 text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-200 font-mono">{nearbyQuery.data.liveSearchMessage}</p>
        </div>
      )}

      {isLoadingDirectory ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : !hasAnyVenue ? (
        <div className="text-center py-24 bg-card/30 rounded-xl border border-border/50">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            {sortByDistance ? <Navigation className="w-8 h-8 text-muted-foreground" /> : <Search className="w-8 h-8 text-muted-foreground" />}
          </div>
          <h3 className="text-xl font-bold uppercase text-white mb-2">
            {sortByDistance ? "No pinned venues nearby yet" : "No bars found"}
          </h3>
          <p className="text-muted-foreground font-mono">
            {sortByDistance
              ? "We only rank Weekender profiles that have a confirmed map pin, so distance results stay accurate."
              : `We couldn't find anything matching "${search}".`}
          </p>
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {visibleBars?.map((bar) => (
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

      {isNearbyMode && discoveredVenues.length > 0 && (
        <section className="space-y-4 pt-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-accent">Live nearby discovery</p>
            <h2 className="text-2xl font-black uppercase tracking-tight">More bars around you</h2>
            <p className="text-sm text-muted-foreground">
              These venues are nearby and open to everyone with public details. They have no Weekender profile yet, so tallies are not available.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {discoveredVenues.map((venue) => (
              <LiveVenueCard key={venue.providerId} venue={venue} />
            ))}
          </div>
          {nearbyQuery.data?.attribution && (
            <a
              href={nearbyQuery.data.attribution.url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-[11px] font-mono text-muted-foreground hover:text-accent"
            >
              {nearbyQuery.data.attribution.label}
            </a>
          )}
        </section>
      )}
    </div>
  );
}
