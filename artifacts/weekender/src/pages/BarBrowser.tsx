import { useState } from "react";
import { useListBars } from "@workspace/api-client-react";
import { BarCard } from "@/components/BarCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { useDebounce } from "@/hooks/use-debounce"; // We'll create this

export function BarBrowser() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  
  const { data: bars, isLoading } = useListBars(
    debouncedSearch ? { search: debouncedSearch } : undefined
  );

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
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

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : !bars || bars.length === 0 ? (
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
          {bars.map((bar) => (
            <motion.div key={bar.id} variants={item}>
              <BarCard bar={bar} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
