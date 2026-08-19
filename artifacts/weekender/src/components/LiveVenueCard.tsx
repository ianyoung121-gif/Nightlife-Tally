import type { DiscoveredVenue } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, MapPin, Navigation, Radar } from "lucide-react";

type LiveVenueCardProps = {
  venue: DiscoveredVenue;
};

function mapsUrl(venue: DiscoveredVenue): string {
  if (venue.googleMapsUri) return venue.googleMapsUri;
  const query = encodeURIComponent([venue.name, venue.address].filter(Boolean).join(" "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function LiveVenueCard({ venue }: LiveVenueCardProps) {
  return (
    <a
      href={mapsUrl(venue)}
      target="_blank"
      rel="noreferrer"
      className="block h-full"
      aria-label={`Open ${venue.name} in Google Maps`}
    >
      <Card className="group h-full border-dashed border-accent/35 bg-card/70 transition-all hover:-translate-y-1 hover:border-accent">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <Badge variant="outline" className="border-accent/40 text-accent font-mono text-[10px]">
              <Radar className="w-3 h-3 mr-1" />
              LIVE NEARBY
            </Badge>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
          </div>

          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight leading-tight">
              {venue.name}
            </h3>
            {venue.address && (
              <p className="mt-2 flex gap-1.5 text-sm text-muted-foreground font-mono">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" />
                <span className="line-clamp-2">{venue.address}</span>
              </p>
            )}
          </div>

          <p className="flex items-center gap-1.5 text-xs font-mono text-accent">
            <Navigation className="w-3.5 h-3.5" />
            {venue.distanceMiles < 0.1 ? "< 0.1 mi away" : `${venue.distanceMiles.toFixed(1)} mi away`}
          </p>
        </CardContent>

        <CardFooter className="border-t border-border/50 px-5 py-3 text-xs font-mono text-muted-foreground">
          Open in Google Maps
        </CardFooter>
      </Card>
    </a>
  );
}