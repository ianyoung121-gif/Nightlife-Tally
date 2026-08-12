import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6 px-4">
      <h1 className="text-8xl font-black text-primary drop-shadow-[0_0_15px_rgba(255,45,120,0.5)]">404</h1>
      <h2 className="text-2xl font-bold uppercase tracking-widest text-white">Party Not Found</h2>
      <p className="text-muted-foreground font-mono max-w-md">
        Looks like you took a wrong turn. The venue you're looking for doesn't exist or moved locations.
      </p>
      <div className="pt-4">
        <Link href="/">
          <Button size="lg" variant="outline">Take Me Back</Button>
        </Link>
      </div>
    </div>
  );
}
