import { useState } from "react";
import { useCreateBar, type BarInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errMsg } from "@/lib-err";

export function VenueSetupForm({ userId }: { userId: number }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", address: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const create = useCreateBar({
    mutation: {
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ["owned-bars"] });
      },
      onError: (e) => setError(errMsg(e, "Could not create your venue profile. Try again.")),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = form.name.trim();
    const address = form.address.trim();
    if (!name || !address) { setError("Venue name and address are required."); return; }
    // Location is optional here; the API ignores ownerId and uses the signed-in user.
    const data: BarInput = { name, address, description: form.description.trim() || undefined, ownerId: userId };
    create.mutate({ data });
  };

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Create your venue profile</CardTitle>
        <CardDescription>
          This creates a new Weekender profile that you own. It does not claim an existing listing, and nothing is matched by name or address.
          Browsing stays free for everyone. A $5/month per-venue membership unlocks specials and opt-in follower notifications (delivered through the Android app).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-mono text-muted-foreground" htmlFor="vs-name">Venue name</label>
            <Input id="vs-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-background" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-mono text-muted-foreground" htmlFor="vs-address">Address</label>
            <Input id="vs-address" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="bg-background" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-mono text-muted-foreground" htmlFor="vs-desc">Description (optional)</label>
            <textarea id="vs-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full min-h-[90px] p-3 rounded-md border border-input bg-background text-sm" />
          </div>
          {error && <p role="alert" className="text-xs font-mono text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create venue profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
