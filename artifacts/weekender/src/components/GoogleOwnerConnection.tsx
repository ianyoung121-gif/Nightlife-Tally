import { useMemo, useState } from "react";
import {
  getGetVenueGoogleConnectionQueryKey,
  getListManagedGoogleLocationsQueryKey,
  useDisconnectVenueGoogle,
  useGetVenueGoogleConnection,
  useLinkVenueGoogleLocation,
  useListManagedGoogleLocations,
  useStartVenueGoogleConnection,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { errMsg } from "@/lib-err";

export function GoogleOwnerConnection({ barId }: { barId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const callback = useMemo(() => new URLSearchParams(window.location.search).get("googleBusiness"), []);
  const statusKey = getGetVenueGoogleConnectionQueryKey(barId);
  const status = useGetVenueGoogleConnection(barId, { query: { queryKey: statusKey, enabled: barId > 0 } });
  const pending = status.data?.pending === true;
  const locKey = getListManagedGoogleLocationsQueryKey(barId);
  const locations = useListManagedGoogleLocations(barId, { query: { queryKey: locKey, enabled: barId > 0 && pending } });
  const refreshPublic = () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/venues") });
  const [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const start = useStartVenueGoogleConnection({
    mutation: {
      onSuccess: (d) => window.location.assign(d.url),
      onError: (e) => toast({ title: errMsg(e, "Could not start Google connection"), variant: "destructive" }),
    },
  });
  const link = useLinkVenueGoogleLocation({
    mutation: {
      onSuccess: () => {
        setSelected(""); setConfirmed(false);
        qc.invalidateQueries({ queryKey: statusKey });
        refreshPublic();
        qc.removeQueries({ queryKey: locKey });
        toast({ title: "Google listing linked" });
      },
      onError: (e) => toast({ title: errMsg(e, "Could not link this listing"), variant: "destructive" }),
    },
  });
  const disconnect = useDisconnectVenueGoogle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: statusKey });
        refreshPublic();
        qc.removeQueries({ queryKey: locKey });
        toast({ title: "Google disconnected" });
      },
      onError: (e) => toast({ title: errMsg(e, "Could not disconnect"), variant: "destructive" }),
    },
  });

  const busyLink = link.isPending || disconnect.isPending;
  const s = status.data;
  const verified = Boolean(s?.providerId && s.verifiedAt && !s.needsReverification && !s.pending);
  const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : "");
  const confirmDisconnect = () => {
    if (window.confirm("Disconnect Google? Your venue loses its verified link and you cannot publish until you reconnect. Membership and billing are not affected.")) disconnect.mutate({ barId });
  };

  return (
    <Card data-testid="card-google-connection">
      <CardHeader>
        <CardTitle>Google owner connection</CardTitle>
        <CardDescription>
          Prove you manage this venue on Google. Linking is free and separate from billing. We use the broad Google business.manage permission only to read your listings, never to change them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {callback === "choose" && pending && <p className="font-mono text-accent" role="status">Google approved access. Choose your listing below. You are not verified until you link it.</p>}
        {callback === "denied" && <p className="font-mono text-yellow-300" role="status">Google access was declined. Nothing was linked.</p>}
        {callback === "error" && <p className="font-mono text-destructive" role="status">Google connection did not complete. Try again.</p>}

        {status.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : status.isError || !s ? (
          <p className="font-mono text-muted-foreground">Could not load Google connection. <button className="underline text-accent" onClick={() => status.refetch()}>Retry</button></p>
        ) : !s.configured ? (
          <p className="font-mono text-muted-foreground" data-testid="text-google-unconfigured">
            Google connection is not set up in this preview. It becomes available on the published website after the update.
          </p>
        ) : pending ? (
          <div className="space-y-3">
            <p className="font-mono text-muted-foreground">Pick the Google listing for this exact venue.</p>
            {locations.isLoading ? <Skeleton className="h-20 w-full" /> : locations.isError ? (
              <p className="font-mono text-muted-foreground">Could not load your listings. <button className="underline text-accent" onClick={() => locations.refetch()}>Retry</button></p>
            ) : (locations.data ?? []).length === 0 ? (
              <p className="font-mono text-muted-foreground">This Google account manages no listings. Reconnect with another account.</p>
            ) : (
              <div className="space-y-2" role="radiogroup">
                {(locations.data ?? []).map((l) => (
                  <label key={l.name} className={`block cursor-pointer rounded-lg border p-3 ${selected === l.name ? "border-primary bg-primary/10" : "border-border"}`}>
                    <input type="radio" name="google-location" className="mr-2" checked={selected === l.name} disabled={busyLink} onChange={() => { setSelected(l.name); setConfirmed(false); }} data-testid={`radio-google-location-${l.name}`} />
                    <span className="font-bold">{l.title}</span>
                    <span className="block text-xs text-muted-foreground pl-5">{l.address}</span>
                  </label>
                ))}
              </div>
            )}
            <label className="flex items-start gap-2 text-xs font-mono">
              <input type="checkbox" checked={confirmed} disabled={!selected || busyLink} onChange={(e) => setConfirmed(e.target.checked)} data-testid="checkbox-same-venue" />
              <span>I confirm this Google listing is the same venue as this Weekender profile.</span>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button disabled={!selected || !confirmed || link.isPending || disconnect.isPending} onClick={() => link.mutate({ barId, data: { locationName: selected, confirmedSameVenue: true } })} data-testid="button-link-google">
                {link.isPending ? "Linking…" : "Link this listing"}
              </Button>
              <Button variant="outline" disabled={disconnect.isPending || link.isPending} onClick={confirmDisconnect}>Cancel connection</Button>
            </div>
          </div>
        ) : s.needsReverification ? (
          <div className="space-y-3">
            <p className="font-mono text-yellow-300">Your Google proof {s.expiresAt ? `expired ${fmt(s.expiresAt)}` : "needs renewal"}. Reconnect to publish again. Your membership, billing and account stay active.</p>
            <div className="flex gap-2 flex-wrap">
              <Button disabled={start.isPending} onClick={() => start.mutate({ barId })} data-testid="button-reconnect-google">{start.isPending ? "Redirecting…" : "Reconnect Google"}</Button>
              <Button variant="outline" disabled={disconnect.isPending} onClick={confirmDisconnect}>Disconnect</Button>
            </div>
          </div>
        ) : verified ? (
          <div className="space-y-3">
            <p className="font-mono text-accent" data-testid="text-google-verified">Verified {fmt(s.verifiedAt)}{s.expiresAt ? `. Renew by ${fmt(s.expiresAt)} (30-day proof).` : "."}</p>
            <Button variant="outline" disabled={disconnect.isPending} onClick={confirmDisconnect} data-testid="button-disconnect-google">{disconnect.isPending ? "Disconnecting…" : "Disconnect Google"}</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-mono text-muted-foreground">Not connected. You will sign in with Google and choose your listing. Public venue info is never hidden either way.</p>
            <Button disabled={start.isPending} onClick={() => start.mutate({ barId })} data-testid="button-connect-google">{start.isPending ? "Redirecting…" : "Connect Google"}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
