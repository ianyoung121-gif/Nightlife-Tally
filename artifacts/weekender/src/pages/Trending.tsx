import { useGetTrendingStats } from "@workspace/api-client-react";
import { BarCard } from "@/components/BarCard";
import { DrinkCard } from "@/components/DrinkCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Flame, Activity } from "lucide-react";
import { motion } from "framer-motion";

export function Trending() {
  const { data: stats, isLoading } = useGetTrendingStats();

  if (isLoading) {
    return (
      <div className="space-y-12 pb-24">
        <div className="h-32 w-full flex items-center justify-center animate-pulse bg-muted rounded-xl">
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
           <Skeleton className="h-[500px] rounded-xl" />
           <Skeleton className="h-[500px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-12 pb-24">
      {/* Header Stats */}
      <div className="bg-card border border-border/50 rounded-3xl p-8 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />
        
        <div className="relative z-10 text-center space-y-6">
          <div className="inline-flex items-center justify-center p-3 bg-background border border-border rounded-full mb-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter drop-shadow-md">
            The Global <span className="text-primary">Leaderboard</span>
          </h1>
          
          <div className="flex flex-wrap justify-center gap-6 md:gap-12 pt-6 border-t border-border/40 max-w-2xl mx-auto">
            <div className="text-center">
              <p className="text-4xl font-black text-white">{stats.totalTallies}</p>
              <p className="text-sm font-mono text-muted-foreground uppercase mt-1">Total Tallies</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-black text-accent">{stats.totalBars}</p>
              <p className="text-sm font-mono text-muted-foreground uppercase mt-1">Active Bars</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Top Drinks */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-border/50 pb-4">
            <Flame className="w-8 h-8 text-primary" />
            <h2 className="text-3xl font-black uppercase tracking-tight">Top Pours</h2>
          </div>
          
          <div className="space-y-4">
            {stats.topDrinks.length === 0 ? (
              <p className="text-muted-foreground font-mono text-center py-12">No data yet.</p>
            ) : (
              stats.topDrinks.map((drink, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={drink.id}
                >
                  <DrinkCard drink={drink} rank={i + 1} showBarName />
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Top Bars */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-border/50 pb-4">
            <Activity className="w-8 h-8 text-accent" />
            <h2 className="text-3xl font-black uppercase tracking-tight">Hottest Venues</h2>
          </div>
          
          <div className="space-y-6">
            {stats.topBars.length === 0 ? (
              <p className="text-muted-foreground font-mono text-center py-12">No data yet.</p>
            ) : (
              stats.topBars.map((bar, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={bar.id}
                >
                  <BarCard bar={bar} rank={i + 1} className="h-[280px]" />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
