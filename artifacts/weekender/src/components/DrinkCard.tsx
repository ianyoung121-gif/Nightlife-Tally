import { useState } from "react";
import { Drink, useTallyDrink } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface DrinkCardProps {
  drink: Drink;
  rank?: number;
  showBarName?: boolean;
}

export function DrinkCard({ drink, rank, showBarName }: DrinkCardProps) {
  const tallyMutation = useTallyDrink();
  const [localTally, setLocalTally] = useState(drink.tallyCount);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleTally = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation if wrapped in Link
    e.stopPropagation();
    
    // Optimistic update
    setLocalTally(prev => prev + 1);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    
    tallyMutation.mutate({ drinkId: drink.id, data: {} });
  };

  return (
    <Card className="overflow-hidden bg-card/60 border-border/50 hover:border-accent/50 transition-colors group">
      <CardContent className="p-0 flex items-stretch min-h-[5rem]">
        {/* Rank indicator */}
        {rank !== undefined && (
          <div className="w-12 flex flex-col items-center justify-center bg-card/80 border-r border-border/50">
            <span className={cn(
              "font-black text-xl",
              rank === 1 ? "text-primary drop-shadow-[0_0_8px_rgba(255,45,120,0.8)]" :
              rank === 2 ? "text-secondary drop-shadow-[0_0_8px_rgba(139,43,226,0.8)]" :
              rank === 3 ? "text-accent drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]" :
              "text-muted-foreground"
            )}>
              #{rank}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold text-lg text-white uppercase tracking-tight leading-none group-hover:text-accent transition-colors">
                {drink.name}
              </h4>
              {showBarName && drink.barName && (
                <p className="text-xs text-primary font-mono mt-1 uppercase tracking-wider">{drink.barName}</p>
              )}
              {drink.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{drink.description}</p>
              )}
            </div>
            {drink.price && (
              <span className="font-mono text-sm text-muted-foreground ml-4 shrink-0 bg-background/50 px-2 py-1 rounded">
                {drink.price}
              </span>
            )}
          </div>
        </div>

        {/* Action / Tally */}
        <div className="w-20 md:w-24 shrink-0 border-l border-border/50 flex flex-col items-center justify-center bg-card/30 relative">
          <Button 
            variant="ghost" 
            className="w-full h-full rounded-none hover:bg-primary/20 text-white flex flex-col gap-1 px-1 group/btn"
            onClick={handleTally}
            disabled={tallyMutation.isPending}
          >
            <motion.div
              animate={isAnimating ? { scale: [1, 1.5, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Plus className="w-5 h-5 text-primary group-hover/btn:text-white" />
            </motion.div>
            <AnimatePresence mode="popLayout">
              <motion.span 
                key={localTally}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                className="font-mono text-lg font-bold"
              >
                {localTally}
              </motion.span>
            </AnimatePresence>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
