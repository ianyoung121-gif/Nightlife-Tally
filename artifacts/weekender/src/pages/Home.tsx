import { useGetTrendingBars, useGetTrendingDrinks } from "@workspace/api-client-react";
import { BarCard } from "@/components/BarCard";
import { DrinkCard } from "@/components/DrinkCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Flame, ArrowRight, Activity } from "lucide-react";
import { motion } from "framer-motion";

export function Home() {
  const { data: bars, isLoading: loadingBars } = useGetTrendingBars();
  const { data: drinks, isLoading: loadingDrinks } = useGetTrendingDrinks();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-12 pb-24">
      {/* Hero Section */}
      <section className="relative py-20 rounded-3xl overflow-hidden bg-muted flex items-center justify-center border border-border/50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none mix-blend-overlay" />
        <div className="relative z-10 text-center space-y-6 px-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center p-2 bg-card/80 border border-primary/30 rounded-full mb-4 shadow-neon-pink">
            <Flame className="w-5 h-5 text-primary mr-2" />
            <span className="text-sm font-bold uppercase tracking-widest text-primary">Live Tonight</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-white">
            Find the <span className="text-primary drop-shadow-[0_0_15px_rgba(255,45,120,0.8)]">Pulse</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground font-mono">
            Track what's pouring. Follow the noise. Make it a night.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/bars">
              <Button size="lg" className="w-full md:w-auto">Explore Bars</Button>
            </Link>
            <Link href="/trending">
              <Button size="lg" variant="outline" className="w-full md:w-auto">Live Leaderboard</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Trending Bars */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-accent" />
            Hot Right Now
          </h2>
          <Link href="/trending" className="text-primary text-sm font-bold uppercase tracking-wider hover:text-white transition-colors flex items-center">
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        
        {loadingBars ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : !bars || bars.length === 0 ? (
          <div className="text-center py-12 bg-card/30 rounded-xl border border-border/50">
            <p className="text-muted-foreground font-mono">No trending activity yet. Be the first to start the party.</p>
          </div>
        ) : (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {bars.slice(0, 3).map((bar, i) => (
              <motion.div key={bar.id} variants={item}>
                <BarCard bar={bar} rank={i + 1} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* Global Trending Drinks */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <GlassWater className="w-6 h-6 text-secondary" />
            Top Pours
          </h2>
        </div>

        {loadingDrinks ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-20 rounded-xl w-full" />
            ))}
          </div>
        ) : !drinks || drinks.length === 0 ? (
          <div className="text-center py-12 bg-card/30 rounded-xl border border-border/50">
            <p className="text-muted-foreground font-mono">No drinks tallied yet.</p>
          </div>
        ) : (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-4 max-w-3xl"
          >
            {drinks.slice(0, 5).map((drink, i) => (
              <motion.div key={drink.id} variants={item}>
                <DrinkCard drink={drink} rank={i + 1} showBarName />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}

// Add GlassWater icon to Home explicitly just in case
import { GlassWater } from "lucide-react";