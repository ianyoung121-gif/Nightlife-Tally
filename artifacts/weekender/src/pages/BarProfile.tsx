import { useState } from "react";
import { useParams } from "wouter";
import { 
  useGetBar, 
  useGetBarStats, 
  useListBarDrinks, 
  useListBarSpecials, 
  useListPatronCoupons,
  useRedeemCoupon,
  useGetBarFollowStatus,
  useFollowBar,
  useUnfollowBar,
  getGetBarFollowStatusQueryKey,
  getGetBarStatsQueryKey,
  getGetBarQueryKey,
  getListBarDrinksQueryKey,
  getListBarSpecialsQueryKey,
  getListPatronCouponsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DrinkCard } from "@/components/DrinkCard";
import { MapPin, Users, Flame, Star, Check, Tag, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

function CouponCard({ coupon, onRedeem }: { 
  coupon: { id: number; code: string; title: string; description?: string | null; discountType: string; discountValue?: string | null; expiresAt?: string | null; maxUses?: number | null; usedCount: number };
  onRedeem: (id: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const discountLabel = () => {
    if (coupon.discountType === "percentage") return coupon.discountValue ? `${coupon.discountValue}% off` : "Discount";
    if (coupon.discountType === "fixed") return coupon.discountValue ? `$${coupon.discountValue} off` : "$ off";
    if (coupon.discountType === "freeitem") return coupon.discountValue || "Free item";
    if (coupon.discountType === "bogo") return "Buy one get one";
    return "Deal";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/5 overflow-hidden"
    >
      {/* Dashed left border like a real coupon */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-secondary to-accent" />

      {/* Ticket notch decoration */}
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-background z-10" />

      <div className="pl-5 pr-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-[10px] uppercase font-mono">
                {discountLabel()}
              </Badge>
            </div>
            <p className="font-black uppercase tracking-tight text-white mt-1">{coupon.title}</p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-white transition-colors shrink-0 mt-1"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Code row - always visible */}
        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 font-mono text-sm tracking-[0.2em] text-primary font-bold bg-background/60 border border-primary/30 rounded px-3 py-1.5 text-center">
            {coupon.code}
          </div>
          <button
            onClick={handleCopy}
            className="p-2 rounded bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors text-primary shrink-0"
            title="Copy code"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2 border-t border-primary/20 mt-3">
                {coupon.description && (
                  <p className="text-xs text-muted-foreground">{coupon.description}</p>
                )}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  {coupon.expiresAt && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Expires {new Date(coupon.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                  {coupon.maxUses !== null && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {coupon.maxUses - coupon.usedCount} remaining
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full text-xs mt-1"
                  onClick={() => onRedeem(coupon.id)}
                >
                  Mark as Redeemed
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function BarProfile() {
  const params = useParams();
  const barId = Number(params.barId);
  const userId = 1; // Mock patron user ID
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: bar, isLoading: loadingBar } = useGetBar(barId, { query: { enabled: !!barId, queryKey: getGetBarQueryKey(barId) } });
  const { data: stats, isLoading: loadingStats } = useGetBarStats(barId, { query: { enabled: !!barId, queryKey: getGetBarStatsQueryKey(barId) } });
  const { data: drinks, isLoading: loadingDrinks } = useListBarDrinks(barId, { query: { enabled: !!barId, queryKey: getListBarDrinksQueryKey(barId) } });
  const { data: specials, isLoading: loadingSpecials } = useListBarSpecials(barId, { query: { enabled: !!barId, queryKey: getListBarSpecialsQueryKey(barId) } });
  const { data: patronCoupons, isLoading: loadingCoupons } = useListPatronCoupons(barId, { query: { enabled: !!barId, queryKey: getListPatronCouponsQueryKey(barId) } });

  const { data: followStatus } = useGetBarFollowStatus(barId, userId, { 
    query: { enabled: !!barId, queryKey: getGetBarFollowStatusQueryKey(barId, userId) } 
  });

  const followMutation = useFollowBar({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBarFollowStatusQueryKey(barId, userId) });
        queryClient.invalidateQueries({ queryKey: getGetBarStatsQueryKey(barId) });
      }
    }
  });

  const unfollowMutation = useUnfollowBar({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBarFollowStatusQueryKey(barId, userId) });
        queryClient.invalidateQueries({ queryKey: getGetBarStatsQueryKey(barId) });
      }
    }
  });

  const redeemCoupon = useRedeemCoupon({
    mutation: {
      onSuccess: () => {
        toast({ title: "Coupon redeemed — show this to your bartender!" });
        queryClient.invalidateQueries({ queryKey: getListPatronCouponsQueryKey(barId) });
      },
      onError: (err: any) => {
        toast({ title: err?.data?.error || "Coupon could not be redeemed", variant: "destructive" });
      }
    }
  });

  const isFollowing = followStatus?.following || false;

  const toggleFollow = () => {
    if (isFollowing) {
      unfollowMutation.mutate({ barId, data: { userId } });
    } else {
      followMutation.mutate({ barId, data: { userId } });
    }
  };

  if (loadingBar) {
    return (
      <div className="space-y-8 animate-pulse">
        <Skeleton className="h-64 md:h-96 w-full rounded-2xl" />
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!bar) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold">Bar not found</h2>
      </div>
    );
  }

  const activeCoupons = patronCoupons || [];

  return (
    <div className="space-y-8 pb-24">
      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden bg-card border border-border/50 shadow-2xl h-64 md:h-96 flex items-end">
        {bar.coverImageUrl && (
          <img src={bar.coverImageUrl} alt={bar.name} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-luminosity" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        
        <div className="relative z-10 p-6 md:p-12 w-full flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <Badge variant="outline" className="border-secondary text-secondary shadow-neon-purple shadow-sm">
                <Users className="w-3 h-3 mr-1" />
                {stats?.followerCount || bar.followerCount} Followers
              </Badge>
              <Badge variant="outline" className="border-primary text-primary shadow-neon-pink shadow-sm">
                <Flame className="w-3 h-3 mr-1" />
                {stats?.totalTallies || bar.totalTallies} Tallies
              </Badge>
              {bar.subscriptionActive && (
                <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] font-mono">
                  PRO VENUE
                </Badge>
              )}
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-white drop-shadow-md">
              {bar.name}
            </h1>
            {bar.address && (
              <p className="text-lg text-muted-foreground font-mono mt-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent" />
                {bar.address}
              </p>
            )}
          </div>
          
          <Button 
            size="lg" 
            variant={isFollowing ? "secondary" : "default"}
            onClick={toggleFollow}
            disabled={followMutation.isPending || unfollowMutation.isPending}
            className="w-full md:w-auto"
          >
            {isFollowing ? (
              <><Check className="w-5 h-5 mr-2" /> Following</>
            ) : (
              <><Star className="w-5 h-5 mr-2" /> Follow Bar</>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content: Drinks */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-3xl font-black uppercase tracking-tight">The Menu</h2>
          
          {bar.description && (
            <div className="bg-card/30 p-6 rounded-xl border border-border/50">
              <p className="text-muted-foreground text-lg leading-relaxed font-sans">{bar.description}</p>
            </div>
          )}

          <div className="space-y-4 mt-8">
            {loadingDrinks ? (
              [1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : !drinks || drinks.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl">
                <p className="text-muted-foreground font-mono">No drinks on the menu yet.</p>
              </div>
            ) : (
              <motion.div 
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
                }}
                className="space-y-4"
              >
                {drinks.map((drink, i) => (
                  <motion.div key={drink.id} variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } }}>
                    <DrinkCard drink={drink} rank={i + 1} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Patron Coupons */}
          {bar.subscriptionActive && (
            <Card className="bg-primary/5 border-primary/20 shadow-neon-pink">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold uppercase tracking-tight text-white mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-primary" /> Patron Coupons
                </h3>
                {loadingCoupons ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : activeCoupons.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-mono">No coupons active right now. Follow this bar to get notified when new ones drop.</p>
                ) : (
                  <div className="space-y-3">
                    {activeCoupons.map(coupon => (
                      <CouponCard
                        key={coupon.id}
                        coupon={coupon}
                        onRedeem={(id) => redeemCoupon.mutate({ couponId: id, data: { userId } })}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Specials */}
          <Card className="bg-secondary/5 border-secondary/20">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold uppercase tracking-tight text-white mb-4 flex items-center">
                <Flame className="w-5 h-5 mr-2 text-secondary" /> Specials
              </h3>
              {loadingSpecials ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !specials || specials.length === 0 ? (
                <p className="text-sm text-muted-foreground font-mono">No specials active right now.</p>
              ) : (
                <div className="space-y-4">
                  {specials.map(special => (
                    <div key={special.id} className="bg-background/80 rounded-lg p-4 border border-secondary/20 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary" />
                      <h4 className="font-bold text-white uppercase text-sm">{special.title}</h4>
                      {special.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{special.description}</p>
                      )}
                      {special.validUntil && (
                        <p className="text-[10px] text-secondary mt-2 font-mono uppercase">
                          Valid until: {new Date(special.validUntil).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Tallies */}
          <Card className="bg-card border-border/50">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold uppercase tracking-tight text-white mb-4">This Week</h3>
              {loadingStats ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-accent drop-shadow-[0_0_8px_rgba(0,229,255,0.5)]">
                    {stats?.weeklyTallies || 0}
                  </span>
                  <span className="text-sm text-muted-foreground font-mono uppercase">Drinks Tallied</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
