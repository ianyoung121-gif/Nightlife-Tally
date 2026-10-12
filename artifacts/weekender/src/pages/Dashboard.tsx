import { useState, useRef, useEffect, useMemo } from "react";
import { 
  useGetBar, 
  useUpdateBar, 
  useListBarSpecials, 
  useCreateSpecial, 
  useDeleteSpecial,
  useGetBarStats,
  useListBarDrinks,
  useCreateDrink,
  useListBarCoupons,
  useCreateCoupon,
  useDeleteCoupon,
  getGetBarQueryKey,
  getListBarSpecialsQueryKey,
  getListBarDrinksQueryKey,
  getGetBarStatsQueryKey,
  getListBarCouponsQueryKey,
  useGetVenueMembership,
  getGetVenueMembershipQueryKey,
  useStartVenueCheckout,
  useOpenVenueBillingPortal,
  useSendVenueNotification,
  useGetVenueGoogleConnection,
  getGetVenueGoogleConnectionQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Flame, Star, Activity, Trash2, Plus, Users, Tag, Lock, Copy, Check, LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { VenueSetupForm } from "@/components/VenueSetupForm";
import { GoogleOwnerConnection } from "@/components/GoogleOwnerConnection";
import { errMsg } from "@/lib-err";
import { motion, AnimatePresence } from "framer-motion";

const DISCOUNT_TYPES = [
  { value: "percentage", label: "% Off" },
  { value: "fixed", label: "$ Off" },
  { value: "freeitem", label: "Free Item" },
  { value: "bogo", label: "Buy One Get One" },
];

function CouponRow({ coupon, onDelete }: { coupon: { id: number; code: string; title: string; description?: string | null; discountType: string; discountValue?: string | null; expiresAt?: string | null; maxUses?: number | null; usedCount: number; isActive: boolean }; onDelete: (id: number) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const discountLabel = () => {
    if (coupon.discountType === "percentage") return coupon.discountValue ? `${coupon.discountValue}% off` : "% off";
    if (coupon.discountType === "fixed") return coupon.discountValue ? `$${coupon.discountValue} off` : "$ off";
    if (coupon.discountType === "freeitem") return coupon.discountValue || "Free item";
    if (coupon.discountType === "bogo") return "Buy one get one";
    return coupon.discountType;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-secondary" />
      <div className="pl-3 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-black uppercase tracking-tight text-white">{coupon.title}</p>
          <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-[10px] font-mono uppercase">
            {discountLabel()}
          </Badge>
        </div>
        {coupon.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{coupon.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 font-mono text-xs bg-background/80 border border-primary/30 rounded px-2 py-1 text-primary hover:bg-primary/10 transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {coupon.code}
          </button>
          {coupon.maxUses != null && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {coupon.usedCount}/{coupon.maxUses} uses
            </span>
          )}
          {coupon.expiresAt && (
            <span className="text-[10px] font-mono text-muted-foreground">
              Expires {new Date(coupon.expiresAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="destructive"
        size="icon"
        onClick={() => onDelete(coupon.id)}
        className="h-8 w-8 shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </motion.div>
  );
}

export function Dashboard() {
  const { user, isLoading: loadingAuth, login } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: ownedBars = [], isLoading: loadingOwnedBars } = useQuery({
    queryKey: ["owned-bars"],
    enabled: Boolean(user),
    queryFn: async () => {
      const response = await fetch("/api/bars/mine", { credentials: "include" });
      if (!response.ok) throw new Error("Could not load your venue.");
      return response.json() as Promise<Array<{ id: number }>>;
    },
  });
  const barId = ownedBars[0]?.id ?? 0;

  const { data: bar, isLoading: loadingBar } = useGetBar(barId, { query: { enabled: barId > 0, queryKey: getGetBarQueryKey(barId) } });
  const { data: stats } = useGetBarStats(barId, { query: { enabled: barId > 0, queryKey: getGetBarStatsQueryKey(barId) } });
  const { data: specials } = useListBarSpecials(barId, { query: { enabled: barId > 0, queryKey: getListBarSpecialsQueryKey(barId) } });
  const { data: drinks } = useListBarDrinks(barId, { query: { enabled: barId > 0, queryKey: getListBarDrinksQueryKey(barId) } });
  const { data: coupons } = useListBarCoupons(barId, { query: { enabled: barId > 0, queryKey: getListBarCouponsQueryKey(barId) } });

  const checkoutSessionId = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get("checkoutSessionId") || q.get("session_id") || undefined;
  }, []);
  const membershipParams = checkoutSessionId ? { checkoutSessionId } : undefined;
  const membership = useGetVenueMembership(barId, membershipParams, {
    query: { enabled: barId > 0 && Boolean(user), queryKey: getGetVenueMembershipQueryKey(barId, membershipParams) },
  });
  const isSubscribed = membership.data?.active === true;
  const googleConn = useGetVenueGoogleConnection(barId, { query: { enabled: barId > 0 && Boolean(user), queryKey: getGetVenueGoogleConnectionQueryKey(barId) } });
  const googleReady = googleConn.isSuccess && googleConn.data?.needsReverification === false;
  const canPublish = isSubscribed && googleReady;
  const publishBlockNote = !isSubscribed ? "" : googleConn.isError ? "Could not check your Google connection, so publishing is paused. Retry from the Google card." : googleConn.isLoading ? "Checking your Google connection before publishing." : googleConn.data?.needsReverification ? "Your Google proof expired. Reconnect Google to publish. Membership and billing stay active, and you can still delete items." : "";
  const goTo = (url: string) => { window.location.assign(url); };
  const checkout = useStartVenueCheckout({
    mutation: {
      onSuccess: (d) => goTo(d.url),
      onError: (e) => toast({ title: errMsg(e, "Could not start checkout"), variant: "destructive" }),
    },
  });
  const portal = useOpenVenueBillingPortal({
    mutation: {
      onSuccess: (d) => goTo(d.url),
      onError: (e) => toast({ title: errMsg(e, "Could not open billing"), variant: "destructive" }),
    },
  });
  const [notice, setNotice] = useState({ title: "", body: "" });
  const [noticeResult, setNoticeResult] = useState<{ ok: boolean; text: string } | null>(null);
  const sendNotice = useSendVenueNotification({
    mutation: {
      onSuccess: (d) => {
        setNoticeResult({ ok: true, text: `${d.message} Accepted by push service: ${d.accepted}. Failed: ${d.failed}. Accepted does not guarantee delivery.` });
        setNotice({ title: "", body: "" });
      },
      onError: (e) => setNoticeResult({ ok: false, text: errMsg(e, "Notification was not sent. You can send one every 24 hours.") }),
    },
  });
  const handleSendNotice = (e: React.FormEvent) => {
    e.preventDefault();
    setNoticeResult(null);
    if (!canPublish || !notice.title.trim() || !notice.body.trim()) return;
    if (!window.confirm("Send this to followers who opted in to alerts from your venue? You can send one every 24 hours.")) return;
    sendNotice.mutate({ barId, data: { title: notice.title.trim(), body: notice.body.trim() } });
  };

  const updateBar = useUpdateBar({
    mutation: {
      onSuccess: () => {
        toast({ title: "Bar updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetBarQueryKey(barId) });
      }
    }
  });

  const createSpecial = useCreateSpecial({
    mutation: {
      onSuccess: () => {
        toast({ title: "Special added" });
        setNewSpecial({ title: "", description: "" });
        queryClient.invalidateQueries({ queryKey: getListBarSpecialsQueryKey(barId) });
      }
    }
  });

  const deleteSpecial = useDeleteSpecial({
    mutation: {
      onSuccess: () => {
        toast({ title: "Special removed" });
        queryClient.invalidateQueries({ queryKey: getListBarSpecialsQueryKey(barId) });
      }
    }
  });

  const createDrink = useCreateDrink({
    mutation: {
      onSuccess: () => {
        toast({ title: "Drink added" });
        setNewDrink({ name: "", description: "", price: "" });
        queryClient.invalidateQueries({ queryKey: getListBarDrinksQueryKey(barId) });
      }
    }
  });

  const createCoupon = useCreateCoupon({
    mutation: {
      onSuccess: () => {
        toast({ title: "Coupon created and ready to share" });
        setNewCoupon({ title: "", description: "", discountType: "percentage", discountValue: "", expiresAt: "", maxUses: "" });
        queryClient.invalidateQueries({ queryKey: getListBarCouponsQueryKey(barId) });
      },
      onError: (err: any) => {
        toast({ title: err?.data?.error || "Failed to create coupon", variant: "destructive" });
      }
    }
  });

  const deleteCoupon = useDeleteCoupon({
    mutation: {
      onSuccess: () => {
        toast({ title: "Coupon removed" });
        queryClient.invalidateQueries({ queryKey: getListBarCouponsQueryKey(barId) });
      }
    }
  });

  const [barForm, setBarForm] = useState({ name: "", description: "", address: "", coverImageUrl: "", latitude: "", longitude: "" });
  const [newSpecial, setNewSpecial] = useState({ title: "", description: "" });
  const [newDrink, setNewDrink] = useState({ name: "", description: "", price: "" });
  const [newCoupon, setNewCoupon] = useState({ title: "", description: "", discountType: "percentage", discountValue: "", expiresAt: "", maxUses: "" });
  const [isLocatingVenue, setIsLocatingVenue] = useState(false);

  const initialized = useRef(false);

  useEffect(() => {
    if (bar && !initialized.current) {
      setBarForm({
        name: bar.name || "",
        description: bar.description || "",
        address: bar.address || "",
        coverImageUrl: bar.coverImageUrl || "",
        latitude: bar.latitude?.toString() || "",
        longitude: bar.longitude?.toString() || "",
      });
      initialized.current = true;
    }
  }, [bar]);

  const handleUpdateBar = (e: React.FormEvent) => {
    e.preventDefault();
    const latitude = barForm.latitude.trim();
    const longitude = barForm.longitude.trim();

    if (Boolean(latitude) !== Boolean(longitude)) {
      toast({ title: "Add both latitude and longitude" });
      return;
    }

    const location =
      latitude && longitude
        ? { latitude: Number(latitude), longitude: Number(longitude) }
        : undefined;

    if (
      location &&
      (!Number.isFinite(location.latitude) ||
        location.latitude < -90 ||
        location.latitude > 90 ||
        !Number.isFinite(location.longitude) ||
        location.longitude < -180 ||
        location.longitude > 180)
    ) {
      toast({ title: "Enter a valid venue pin", description: "Latitude must be -90 to 90 and longitude must be -180 to 180." });
      return;
    }

    updateBar.mutate({
      barId,
      data: {
        name: barForm.name,
        description: barForm.description || undefined,
        address: barForm.address || undefined,
        coverImageUrl: barForm.coverImageUrl || undefined,
        ...(location ?? {}),
      },
    });
  };

  const useCurrentVenueLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location is unavailable", description: "Enter the venue coordinates manually instead." });
      return;
    }

    setIsLocatingVenue(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBarForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setIsLocatingVenue(false);
        toast({ title: "Venue location captured", description: "Review the pin, then save your profile to verify it." });
      },
      (error) => {
        setIsLocatingVenue(false);
        toast({ title: "Could not get your location", description: error.message || "Enter the venue coordinates manually instead." });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const handleCreateSpecial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpecial.title || !canPublish) return;
    createSpecial.mutate({ barId, data: newSpecial });
  };

  const handleCreateDrink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrink.name) return;
    createDrink.mutate({ barId, data: newDrink });
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupon.title || !newCoupon.discountType || !canPublish) return;
    createCoupon.mutate({
      barId,
      data: {
        title: newCoupon.title,
        description: newCoupon.description || undefined,
        discountType: newCoupon.discountType,
        discountValue: newCoupon.discountValue || undefined,
        expiresAt: newCoupon.expiresAt || undefined,
        maxUses: newCoupon.maxUses ? Number(newCoupon.maxUses) : undefined,
      }
    });
  };

  if (loadingAuth) return (
    <div className="p-8 text-center">
      <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <div className="p-8 text-center text-muted-foreground"><button className="text-primary underline" onClick={login}>Sign in</button> to manage your venue.</div>;
  if (loadingOwnedBars || loadingBar) return (
    <div className="p-8 text-center">
      <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!barId) return <div className="py-8"><VenueSetupForm userId={user.id} /></div>;
  if (!bar) return <div className="p-8 text-center text-muted-foreground">Venue unavailable.</div>;


  return (
    <div className="space-y-8 pb-24 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Owner Dashboard</h1>
          <p className="text-muted-foreground font-mono mt-2">Manage your presence on The Weekender.</p>
        </div>
        <Badge
          className={isSubscribed
            ? "bg-primary/20 text-primary border-primary/40 shadow-neon-pink text-xs font-mono px-3 py-1"
            : "bg-muted text-muted-foreground border-border text-xs font-mono px-3 py-1"
          }
        >
          {membership.isLoading ? "CHECKING" : isSubscribed ? "ACTIVE MEMBER" : "NO MEMBERSHIP"}
        </Badge>
      </div>

      <Card className={isSubscribed ? "border-primary/30 bg-primary/5" : "border-border/50"}>
        <CardHeader>
          <CardTitle>Venue membership</CardTitle>
          <CardDescription>$5/month per venue. Required to publish specials and coupons. Billing is handled by Stripe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {checkoutSessionId && membership.isFetching && <p className="text-sm font-mono text-accent">Verifying your checkout with billing…</p>}
          {checkoutSessionId && !membership.isFetching && !membership.isError && !isSubscribed && (
            <p className="text-sm font-mono text-yellow-300">Checkout is still pending. Membership unlocks only once billing confirms it.</p>
          )}
          {membership.isError ? (
            <p className="text-sm font-mono text-muted-foreground">Could not verify membership. <button className="text-accent underline" onClick={() => membership.refetch()}>Retry</button></p>
          ) : membership.isLoading ? (
            <p className="text-sm font-mono text-muted-foreground">Checking membership…</p>
          ) : isSubscribed ? (
            <>
              <p className="text-sm text-muted-foreground">
                Active at ${membership.data?.monthlyPrice} {membership.data?.currency?.toUpperCase()} per month.
                {membership.data?.cancelAtPeriodEnd && " Cancels at the end of the current period."}
              </p>
              <Button variant="outline" disabled={portal.isPending} onClick={() => portal.mutate({ barId })}>
                {portal.isPending ? "Opening…" : "Manage billing or cancel"}
              </Button>
            </>
          ) : (
            <Button disabled={checkout.isPending} onClick={() => checkout.mutate({ barId })}>
              {checkout.isPending ? "Redirecting to Stripe…" : "Subscribe for $5/month"}
            </Button>
          )}
        </CardContent>
      </Card>

      <GoogleOwnerConnection barId={barId} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-primary">Followers</p>
              <p className="text-4xl font-black mt-2">{stats?.followerCount || 0}</p>
            </div>
            <Users className="w-10 h-10 text-primary opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-secondary/10 border-secondary/20">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-secondary">Total Tallies</p>
              <p className="text-4xl font-black mt-2">{stats?.totalTallies || 0}</p>
            </div>
            <Flame className="w-10 h-10 text-secondary opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-accent">Menu Items</p>
              <p className="text-4xl font-black mt-2">{drinks?.length || 0}</p>
            </div>
            <Activity className="w-10 h-10 text-accent opacity-50" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Info</CardTitle>
              <CardDescription>How your bar appears to patrons.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateBar} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-mono text-muted-foreground">Bar Name</label>
                  <Input value={barForm.name} onChange={e => setBarForm({...barForm, name: e.target.value})} className="font-bold bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-mono text-muted-foreground">Address</label>
                  <Input value={barForm.address} onChange={e => setBarForm({...barForm, address: e.target.value})} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-mono text-muted-foreground">Description</label>
                  <textarea
                    value={barForm.description}
                    onChange={e => setBarForm({...barForm, description: e.target.value})}
                    className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-accent/15 p-2 text-accent">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold">Verified venue pin</p>
                      <p className="text-xs text-muted-foreground">
                        {bar.locationVerifiedAt
                          ? `Verified ${new Date(bar.locationVerifiedAt).toLocaleDateString()}. Update it if the pin is no longer exact.`
                          : "Required for nearby lists, crawls, and Date Night. Stand at your venue or enter the pin manually."}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-mono text-muted-foreground">Latitude</label>
                      <Input
                        inputMode="decimal"
                        placeholder="e.g. 40.712776"
                        value={barForm.latitude}
                        onChange={e => setBarForm({ ...barForm, latitude: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-mono text-muted-foreground">Longitude</label>
                      <Input
                        inputMode="decimal"
                        placeholder="e.g. -74.005974"
                        value={barForm.longitude}
                        onChange={e => setBarForm({ ...barForm, longitude: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                  </div>
                  <Button type="button" variant="outline" onClick={useCurrentVenueLocation} disabled={isLocatingVenue}>
                    <LocateFixed className={`w-4 h-4 mr-2 ${isLocatingVenue ? "animate-spin" : ""}`} />
                    {isLocatingVenue ? "Finding venue…" : "Use my current location"}
                  </Button>
                  {bar.locationVerifiedAt && (
                    <p className="flex items-center gap-1.5 text-xs font-mono text-accent">
                      <ShieldCheck className="h-3.5 w-3.5" /> This pin is currently verified.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-mono text-muted-foreground">Cover Image URL</label>
                  <Input value={barForm.coverImageUrl} onChange={e => setBarForm({...barForm, coverImageUrl: e.target.value})} className="bg-background" />
                </div>
                <Button type="submit" disabled={updateBar.isPending} className="w-full">
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Active Specials */}
          <Card>
            <CardHeader>
              <CardTitle>Active Specials</CardTitle>
              <CardDescription>Promote deals to your followers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                {!specials || specials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active specials.</p>
                ) : (
                  specials.map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border border-border">
                      <div>
                        <p className="font-bold text-sm uppercase">{s.title}</p>
                        {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteSpecial.mutate({ specialId: s.id })}
                        disabled={deleteSpecial.isPending}
                        className="h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-bold uppercase mb-3 text-primary">Add Special</h4>
                {!isSubscribed && <p className="text-xs font-mono text-muted-foreground mb-3">An active membership is required to publish new specials. You can still delete existing ones.</p>}
                {publishBlockNote && <p className="text-xs font-mono text-yellow-300 mb-3" role="status">{publishBlockNote}</p>}
                <form onSubmit={handleCreateSpecial} className="space-y-3">
                  <Input placeholder="Special Title (e.g. $5 Margaritas)" value={newSpecial.title} onChange={e => setNewSpecial({...newSpecial, title: e.target.value})} className="bg-background" />
                  <Input placeholder="Description (Optional)" value={newSpecial.description} onChange={e => setNewSpecial({...newSpecial, description: e.target.value})} className="bg-background" />
                  <Button type="submit" variant="secondary" disabled={createSpecial.isPending || !canPublish} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Publish Special
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Send a notification</CardTitle>
              <CardDescription>Goes only to followers who explicitly opted in. One per 24 hours. Delivery today is through the Android app.</CardDescription>
            </CardHeader>
            <CardContent>
              {!isSubscribed ? (
                <p className="text-sm text-muted-foreground font-mono">Requires an active membership.</p>
              ) : (
                <form onSubmit={handleSendNotice} className="space-y-3">
                  {publishBlockNote && <p className="text-xs font-mono text-yellow-300" role="status">{publishBlockNote}</p>}
                  <Input required maxLength={80} placeholder="Title" value={notice.title} onChange={e => setNotice({ ...notice, title: e.target.value })} className="bg-background" />
                  <textarea required maxLength={240} placeholder="Message" value={notice.body} onChange={e => setNotice({ ...notice, body: e.target.value })} className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm" />
                  <p className="text-[10px] font-mono text-muted-foreground">{notice.title.length}/80 title · {notice.body.length}/240 message</p>
                  {noticeResult && <p role="status" className={`text-xs font-mono ${noticeResult.ok ? "text-accent" : "text-destructive"}`}>{noticeResult.text}</p>}
                  <Button type="submit" className="w-full" disabled={sendNotice.isPending || !canPublish}>{sendNotice.isPending ? "Sending…" : "Send to opted-in followers"}</Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Drink Menu */}
          <Card>
            <CardHeader>
              <CardTitle>Drink Menu</CardTitle>
              <CardDescription>What's pouring at your bar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleCreateDrink} className="space-y-3 p-4 bg-muted/30 rounded-xl border border-primary/20">
                <h4 className="text-sm font-bold uppercase text-accent mb-2">Add New Drink</h4>
                <Input placeholder="Drink Name" value={newDrink.name} onChange={e => setNewDrink({...newDrink, name: e.target.value})} className="bg-background border-border/50" required />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Price (e.g. $12)" value={newDrink.price} onChange={e => setNewDrink({...newDrink, price: e.target.value})} className="bg-background border-border/50" />
                  <Button type="submit" variant="cyan" disabled={createDrink.isPending} className="w-full">
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
              </form>
              <div className="space-y-2 mt-4">
                {!drinks || drinks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded">No drinks added yet.</p>
                ) : (
                  drinks.map((d, i) => (
                    <div key={d.id} className="flex items-center justify-between p-3 border-b border-border/40 last:border-0 hover:bg-muted/50 rounded transition-colors">
                      <div>
                        <span className="text-xs font-mono text-muted-foreground mr-3 w-4 inline-block">#{i+1}</span>
                        <span className="font-bold text-white uppercase tracking-tight">{d.name}</span>
                        {d.price && <span className="text-xs ml-2 text-muted-foreground font-mono">{d.price}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Flame className="w-3 h-3 text-primary" />
                        <span className="font-mono font-bold text-primary">{d.tallyCount}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Coupons — Subscriber Only */}
          <Card className={isSubscribed ? "border-primary/30 bg-primary/5" : "border-border/40 bg-muted/20"}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary" />
                    Patron Coupons
                  </CardTitle>
                  <CardDescription>
                    {isSubscribed
                      ? "Create exclusive coupons for your followers and regulars."
                      : "Activate a venue membership to unlock coupon creation for your followers."}
                  </CardDescription>
                </div>
                {isSubscribed && (
                  <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] font-mono shrink-0">PRO</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!isSubscribed ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <Lock className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Membership required</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      For $5/month, create exclusive coupon codes your followers can show at the bar.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">Membership is verified through billing before coupon tools are enabled.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Existing coupons */}
                  <AnimatePresence>
                    {!coupons || coupons.length === 0 ? (
                      <p className="text-sm text-muted-foreground font-mono text-center py-4 border border-dashed border-primary/20 rounded-lg">
                        No coupons yet — create your first one below.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {coupons.map(c => (
                          <CouponRow
                            key={c.id}
                            coupon={c}
                            onDelete={(id) => deleteCoupon.mutate({ couponId: id })}
                          />
                        ))}
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Create new coupon */}
                  <div className="pt-4 border-t border-primary/20">
                    <h4 className="text-sm font-bold uppercase mb-3 text-primary">Create Coupon</h4>
                    {publishBlockNote && <p className="text-xs font-mono text-yellow-300 mb-3" role="status">{publishBlockNote}</p>}
                    <form onSubmit={handleCreateCoupon} className="space-y-3">
                      <Input
                        placeholder="Coupon Title (e.g. Happy Hour Discount)"
                        value={newCoupon.title}
                        onChange={e => setNewCoupon({...newCoupon, title: e.target.value})}
                        className="bg-background"
                        required
                      />
                      <Input
                        placeholder="Description (optional)"
                        value={newCoupon.description}
                        onChange={e => setNewCoupon({...newCoupon, description: e.target.value})}
                        className="bg-background"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={newCoupon.discountType}
                          onChange={e => setNewCoupon({...newCoupon, discountType: e.target.value})}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {DISCOUNT_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <Input
                          placeholder={newCoupon.discountType === "percentage" ? "e.g. 20" : newCoupon.discountType === "fixed" ? "e.g. 5" : "e.g. Free Shot"}
                          value={newCoupon.discountValue}
                          onChange={e => setNewCoupon({...newCoupon, discountValue: e.target.value})}
                          className="bg-background"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-muted-foreground uppercase">Expires (optional)</label>
                          <Input
                            type="date"
                            value={newCoupon.expiresAt}
                            onChange={e => setNewCoupon({...newCoupon, expiresAt: e.target.value})}
                            className="bg-background"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-muted-foreground uppercase">Max uses (optional)</label>
                          <Input
                            type="number"
                            placeholder="Unlimited"
                            value={newCoupon.maxUses}
                            onChange={e => setNewCoupon({...newCoupon, maxUses: e.target.value})}
                            className="bg-background"
                            min={1}
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={createCoupon.isPending || !canPublish}>
                        <Plus className="w-4 h-4 mr-2" /> Generate Coupon Code
                      </Button>
                    </form>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
