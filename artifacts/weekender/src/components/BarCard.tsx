import { Bar } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { MapPin, Users, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface BarCardProps {
  bar: Bar;
  rank?: number;
  className?: string;
}

export function BarCard({ bar, rank, className }: BarCardProps) {
  return (
    <Link href={`/bars/${bar.id}`}>
      <Card className={cn("group cursor-pointer overflow-hidden transition-all hover:border-primary hover:-translate-y-1 relative h-full flex flex-col", className)}>
        {rank !== undefined && (
          <div className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center shadow-neon-pink text-lg shadow-lg">
            {rank}
          </div>
        )}
        <div className="h-48 relative overflow-hidden bg-muted">
          {bar.coverImageUrl ? (
            <img 
              src={bar.coverImageUrl} 
              alt={bar.name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-60 group-hover:opacity-80"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <span className="text-4xl font-bold text-muted-foreground/30 uppercase tracking-widest">{bar.name.substring(0,2)}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-2xl font-black text-white uppercase tracking-tight truncate drop-shadow-md">
              {bar.name}
            </h3>
            {bar.address && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1 font-mono">
                <MapPin className="w-3 h-3 text-accent" />
                <span className="truncate">{bar.address}</span>
              </p>
            )}
          </div>
        </div>
        
        <CardContent className="flex-1 pt-4">
          <p className="text-muted-foreground text-sm line-clamp-2">
            {bar.description || "No description provided."}
          </p>
        </CardContent>
        
        <CardFooter className="border-t border-border/50 pt-4 flex justify-between items-center bg-card/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <Users className="w-4 h-4 text-secondary" />
            <span>{bar.followerCount}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
              <Flame className="w-3 h-3 mr-1 text-primary" />
              {bar.totalTallies}
            </Badge>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
