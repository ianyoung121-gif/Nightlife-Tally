import { 
  useGetUser, 
  useGetUserFollowing,
  getGetUserQueryKey,
  getGetUserFollowingQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { BarCard } from "@/components/BarCard";
import { Skeleton } from "@/components/ui/skeleton";
import { User as UserIcon, Heart, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export function PatronProfile() {
  const { user, isLoading: loadingAuth, login } = useAuth();
  const userId = user?.id;
  
  const { data: profile, isLoading: loadingUser } = useGetUser(userId ?? 0, { query: { enabled: Boolean(userId), queryKey: getGetUserQueryKey(userId ?? 0) } });
  const { data: following, isLoading: loadingFollowing } = useGetUserFollowing(userId ?? 0, { query: { enabled: Boolean(userId), queryKey: getGetUserFollowingQueryKey(userId ?? 0) } });

  if (loadingAuth || (user && loadingUser)) {
    return <div className="p-8"><Skeleton className="h-32 w-full rounded-xl max-w-2xl mx-auto" /></div>;
  }
  if (!user) {
    return <div className="mx-auto max-w-xl space-y-5 py-24 text-center"><UserIcon className="mx-auto h-12 w-12 text-primary" /><h1 className="text-3xl font-black uppercase">Your Weekender account</h1><p className="text-muted-foreground">Log in to save bars and keep your profile on every device.</p><Button onClick={login}>Log in</Button></div>;
  }

  return (
    <div className="space-y-12 pb-24 max-w-5xl mx-auto">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 pt-8">
        <div className="w-32 h-32 rounded-full bg-card border-4 border-primary/20 flex items-center justify-center shadow-neon-pink relative overflow-hidden">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.username} className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-12 h-12 text-primary" />
          )}
        </div>
        <div className="text-center md:text-left pt-4">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white">
            @{profile?.username || user.username}
          </h1>
          <p className="text-muted-foreground font-mono mt-1">Patron since {new Date(profile?.createdAt || user.createdAt).getFullYear()}</p>
        </div>
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-4 p-5 rounded-2xl border border-accent/20 bg-accent/5">
        <ShieldCheck className="w-6 h-6 text-accent shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-accent uppercase tracking-wide text-sm">Your tallies are private</p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            The Weekender never records which drinks you personally tally. Tallies are anonymous crowd-votes — only aggregate counts are stored. There is no log linking your account to any specific drink or bar visit.
          </p>
        </div>
      </div>

      {/* Followed Bars */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-border/50 pb-4">
          <Heart className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-black uppercase tracking-tight">Your Bars</h2>
        </div>

        {loadingFollowing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
          </div>
        ) : !following || following.length === 0 ? (
          <div className="text-center py-16 bg-card/30 rounded-xl border border-border/50">
            <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground font-mono text-lg">No bars followed yet.</p>
            <p className="text-muted-foreground font-mono text-sm mt-1">Hit Follow on any bar to save it here.</p>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.1 } }
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {following.map(bar => (
              <motion.div
                key={bar.id}
                variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              >
                <BarCard bar={bar} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
