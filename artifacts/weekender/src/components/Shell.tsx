import { Link, useLocation } from "wouter";
import { Flame, GlassWater, LayoutDashboard, MapPin, User, Dices } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Discover", icon: MapPin },
    { href: "/bars", label: "All Bars", icon: GlassWater },
    { href: "/trending", label: "Trending", icon: Flame },
    { href: "/spin", label: "Spin", icon: Dices },
    { href: "/profile", label: "Profile", icon: User },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center px-4 justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center group-hover:shadow-neon-pink transition-all duration-300">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tighter uppercase text-white group-hover:text-primary transition-colors">
              The Weekender
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-sm font-medium transition-all hover:text-white uppercase tracking-wider relative",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute -bottom-[22px] left-0 right-0 h-0.5 bg-primary shadow-neon-pink" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 relative">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 z-50 w-full border-t border-border/40 bg-background/90 backdrop-blur-lg pb-safe">
        <div className="flex items-center justify-around h-16 px-4">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 justify-center w-full h-full text-xs font-medium transition-colors",
                  isActive ? "text-primary drop-shadow-[0_0_8px_rgba(255,45,120,0.5)]" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="scale-90">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
