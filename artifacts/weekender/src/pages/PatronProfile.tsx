import { 
  useGetUser, 
  useGetUserFollowing, 
  useGetUserActivity,
  getGetUserQueryKey,
  getGetUserFollowingQueryKey,
  getGetUserActivityQueryKey
} from "@workspace/api-client-react";
import { BarCard } from "@/components/BarCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { User as UserIcon, Flame, Clock, Heart } from "lucide-react";
import { motion } from "framer-motion";

export function PatronProfile() {
  const userId = 1; // Mock patron ID
  
  const { data: user, isLoading: loadingUser } = useGetUser(userId, { query: { enabled: true, queryKey: getGetUserQueryKey(userId) } });
  const { data: following, isLoading: loadingFollowing } = useGetUserFollowing(userId, { query: { enabled: true, queryKey: getGetUserFollowingQueryKey(userId) } });
  const { data: activity, isLoading: loadingActivity } = useGetUserActivity(userId, { query: { enabled: true, queryKey: getGetUserActivityQueryKey(userId) } });

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loadingUser) {
    return <div className="p-8"><Skeleton className="h-32 w-full rounded-xl max-w-2xl mx-auto" /></div>;
  }

  return (
    <div className="space-y-12 pb-24 max-w-5xl mx-auto">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 pt-8">
        <div className="w-32 h-32 rounded-full bg-card border-4 border-primary/20 flex items-center justify-center shadow-neon-pink relative overflow-hidden">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-12 h-12 text-primary" />
          )}
        </div>
        <div className="text-center md:text-left pt-4">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white">
            @{user?.username || 'Guest'}
          </h1>
          <p className="text-muted-foreground font-mono mt-1">Patron since {new Date(user?.createdAt || Date.now()).getFullYear()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Activity Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-4">
            <Clock className="w-5 h-5 text-accent" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Recent Tallies</h2>
          </div>

          {loadingActivity ? (
            <div className="space-y-4">
               {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : !activity || activity.length === 0 ? (
            <div className="text-center py-12 bg-card/30 rounded-xl border border-border/50">
              <Flame className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground font-mono">No drinks tallied yet. Get out there.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activity.map((item, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={`${item.drinkId}-${item.createdAt}`}
                >
                  <Card className="bg-card/50 hover:bg-card border-border/50 transition-colors">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Flame className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-white uppercase text-lg leading-tight">
                            {item.drinkName}
                          </p>
                          <Link href={`/bars/${item.barId}`} className="text-sm font-mono text-muted-foreground hover:text-accent transition-colors">
                            @ {item.barName}
                          </Link>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground bg-background/50 px-2 py-1 rounded">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Followed Bars */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-4">
            <Heart className="w-5 h-5 text-secondary" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Your Spots</h2>
          </div>

          {loadingFollowing ? (
            <div className="space-y-4">
               {[1,2].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : !following || following.length === 0 ? (
            <div className="text-center py-8 bg-card/30 rounded-xl border border-dashed border-border/50">
              <p className="text-sm text-muted-foreground font-mono">You aren't following any bars.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {following.map((bar) => (
                <BarCard key={bar.id} bar={bar} className="h-64" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
