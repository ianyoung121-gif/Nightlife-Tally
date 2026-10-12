import { useParams, Link } from "wouter";
import {
  useGetPublicVenue,
  useGetPlaceFavoriteStatus,
  useSavePlaceFavorite,
  useRemovePlaceFavorite,
  getGetPlaceFavoriteStatusQueryKey,
  getGetPlaceFavoritesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicSpecials } from "@/components/PublicSpecials";
import { useToast } from "@/hooks/use-toast";
import { errMsg } from "@/lib-err";
import { Check, Clock, ExternalLink, Globe, MapPin, Phone, Star } from "lucide-react";

export function PlaceDetail() {
  const { providerId = "" } = useParams<{ providerId: string }>();
  const { user, login, isLoading: loadingAuth } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const venue = useGetPublicVenue(providerId, { query: { enabled: Boolean(providerId), queryKey: ["/api/venues", providerId] } });
  const favKey = getGetPlaceFavoriteStatusQueryKey(providerId);
  const status = useGetPlaceFavoriteStatus(providerId, { query: { enabled: Boolean(providerId && user), queryKey: favKey } });
  const done = (favorited: boolean) => ({
    onSuccess: () => {
      qc.setQueryData(favKey, { favorited });
      qc.invalidateQueries({ queryKey: favKey });
      qc.invalidateQueries({ queryKey: getGetPlaceFavoritesQueryKey() });
    },
    onError: (e: unknown) => toast({ title: errMsg(e, "Could not update favorite"), variant: "destructive" }),
  });
  const save = useSavePlaceFavorite({ mutation: done(true) });
  const remove = useRemovePlaceFavorite({ mutation: done(false) });
  const favorited = status.data?.favorited === true;

  const toggle = () => {
    if (!user) return login();
    if (favorited) remove.mutate({ providerId });
    else save.mutate({ providerId });
  };

  if (venue.isLoading) {
    return <div className="space-y-6"><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (venue.isError || !venue.data) {
    return (
      <div className="text-center py-24 space-y-4">
        <h2 className="text-2xl font-bold uppercase">Venue details unavailable</h2>
        <p className="text-muted-foreground font-mono text-sm">We could not load this venue right now.</p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => venue.refetch()}>Retry</Button>
          <Button variant="outline" asChild><Link href="/bars">Back to directory</Link></Button>
        </div>
      </div>
    );
  }
  const v = venue.data;
  const busy = save.isPending || remove.isPending;

  return (
    <div className="space-y-8 pb-24">
      <div className="rounded-3xl border border-border/50 bg-card p-6 md:p-10 space-y-4">
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-accent">Venue details from Google Places</p>
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white">{v.name}</h1>
        {v.address && <p className="flex gap-2 font-mono text-muted-foreground"><MapPin className="w-4 h-4 mt-1 text-accent shrink-0" />{v.address}</p>}
        {v.businessStatus && v.businessStatus !== "OPERATIONAL" && (
          <p className="text-xs font-mono text-yellow-300 uppercase">Status: {v.businessStatus.replace(/_/g, " ").toLowerCase()}</p>
        )}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={toggle} disabled={loadingAuth || busy || (Boolean(user) && status.isLoading)} variant={favorited ? "secondary" : "default"}>
            {favorited ? <><Check className="w-4 h-4 mr-2" />Saved to favorites</> : <><Star className="w-4 h-4 mr-2" />{user ? "Save favorite" : "Log in to save"}</>}
          </Button>
          {v.websiteUri && (
            <Button variant="outline" asChild>
              <a href={v.websiteUri} target="_blank" rel="noreferrer noopener"><Globe className="w-4 h-4 mr-2" />Official website</a>
            </Button>
          )}
          {v.googleMapsUri && (
            <Button variant="outline" asChild>
              <a href={v.googleMapsUri} target="_blank" rel="noreferrer noopener"><ExternalLink className="w-4 h-4 mr-2" />Google Maps</a>
            </Button>
          )}
        </div>
        {status.isError && <p className="text-xs font-mono text-muted-foreground">Could not check favorite status.</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card/30 p-6 space-y-4">
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />Hours</h2>
          {v.hours.length === 0 ? (
            <p className="text-sm font-mono text-muted-foreground">Hours are not listed.</p>
          ) : (
            <ul className="space-y-1.5 font-mono text-sm text-muted-foreground">
              {v.hours.map((h) => <li key={h}>{h}</li>)}
            </ul>
          )}
          {v.phone && <p className="flex items-center gap-2 font-mono text-sm pt-2"><Phone className="w-4 h-4 text-accent" /><a className="hover:underline" href={`tel:${v.phone}`}>{v.phone}</a></p>}
          <p className="text-[11px] font-mono text-muted-foreground pt-2">
            Community tallies are only available for venues with a Weekender profile.
          </p>
        </div>
        <Link
          href={`/spin?providerId=${encodeURIComponent(providerId)}`}
          data-testid="link-spin-specials"
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary hover:underline"
        >
          Spin this place's checked specials
        </Link>
        <PublicSpecials target={{ providerId }} />
      </div>
    </div>
  );
}
