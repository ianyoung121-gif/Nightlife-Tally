import { useState } from "react";
import {
  useListPublicSpecials,
  useGetEditorAccess,
  useCreatePublicSpecial,
  useDeletePublicSpecial,
  getListPublicSpecialsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { errMsg } from "@/lib-err";
import { ExternalLink, Flame, Trash2 } from "lucide-react";

type Target = { barId: number; providerId?: undefined } | { providerId: string; barId?: undefined };

export function PublicSpecials({ target }: { target: Target }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const params = target.barId !== undefined ? { barId: target.barId } : { providerId: target.providerId };
  const key = getListPublicSpecialsQueryKey(params);
  const { data, isLoading, isError, refetch } = useListPublicSpecials(params, { query: { queryKey: key } });
  const access = useGetEditorAccess({ query: { enabled: Boolean(user), queryKey: ["/api/me/editor-access", user?.id ?? 0] } });
  const canCurate = Boolean(user) && access.data?.canCurate === true;

  const [form, setForm] = useState({ title: "", description: "", sourceUrl: "", expiresAt: "", confirmed: false });
  const [formError, setFormError] = useState<string | null>(null);

  const create = useCreatePublicSpecial({
    mutation: {
      onSuccess: () => {
        toast({ title: "Checked special published" });
        setForm({ title: "", description: "", sourceUrl: "", expiresAt: "", confirmed: false });
        qc.invalidateQueries({ queryKey: key });
      },
      onError: (e) => setFormError(errMsg(e, "Could not publish this special.")),
    },
  });
  const del = useDeletePublicSpecial({
    mutation: {
      onSuccess: () => {
        toast({ title: "Special removed" });
        qc.invalidateQueries({ queryKey: key });
      },
      onError: (e) => toast({ title: errMsg(e, "Could not remove special"), variant: "destructive" }),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    let url: URL;
    try { url = new URL(form.sourceUrl.trim()); } catch { setFormError("Enter the official website link."); return; }
    if (url.protocol !== "https:") { setFormError("The source link must be HTTPS."); return; }
    const exp = new Date(form.expiresAt);
    const now = Date.now();
    if (Number.isNaN(exp.getTime()) || exp.getTime() <= now) { setFormError("Choose a future expiry."); return; }
    if (exp.getTime() > now + 30 * 24 * 3600 * 1000) { setFormError("Expiry can be at most 30 days out."); return; }
    if (!form.confirmed) { setFormError("Confirm you checked the official source."); return; }
    create.mutate({
      data: {
        ...(target.barId !== undefined ? { barId: target.barId } : { providerId: target.providerId }),
        title: form.title.trim(),
        description: form.description.trim(),
        sourceUrl: url.toString(),
        expiresAt: exp.toISOString(),
        confirmedChecked: true,
      },
    });
  };

  const now = Date.now();
  const current = (data ?? []).filter((s) => new Date(s.expiresAt).getTime() > now);

  return (
    <Card className="bg-secondary/5 border-secondary/20">
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-xl font-bold uppercase tracking-tight text-white flex items-center">
            <Flame className="w-5 h-5 mr-2 text-secondary" /> Checked specials
          </h3>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Sourced from the venue's official website by a Weekender curator. Always confirm with the venue.
          </p>
        </div>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : isError ? (
          <div className="text-sm font-mono text-muted-foreground">
            Could not load checked specials.{" "}
            <button className="text-accent underline" onClick={() => refetch()}>Retry</button>
          </div>
        ) : current.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono">No checked specials right now.</p>
        ) : (
          <div className="space-y-3">
            {current.map((s) => (
              <div key={s.id} className="bg-background/80 rounded-lg p-4 border border-secondary/20 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary" />
                <div className="flex justify-between gap-2">
                  <h4 className="font-bold text-white uppercase text-sm">{s.title}</h4>
                  {canCurate && (
                    <Button variant="destructive" size="icon" className="h-7 w-7 shrink-0" aria-label="Delete special"
                      disabled={del.isPending} onClick={() => del.mutate({ specialId: s.id })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                <p className="text-[10px] font-mono text-secondary mt-2 uppercase">
                  Checked {new Date(s.checkedAt).toLocaleDateString()} · Expires {new Date(s.expiresAt).toLocaleDateString()}
                </p>
                <a href={s.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[11px] font-mono text-accent hover:underline mt-1">
                  Official source <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        )}

        {canCurate && (
          <form onSubmit={submit} className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-sm font-bold uppercase text-primary">Curate a special</h4>
            <Input required maxLength={120} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-background" />
            <Input required maxLength={400} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-background" />
            <Input required type="url" placeholder="https:// official website page" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} className="bg-background" />
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">Expires (within 30 days)</label>
              <Input required type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="bg-background" />
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="mt-0.5" checked={form.confirmed} onChange={(e) => setForm({ ...form, confirmed: e.target.checked })} />
              I checked this on the venue's official website and it is current.
            </label>
            {formError && <p role="alert" className="text-xs text-destructive font-mono">{formError}</p>}
            <p className="text-[10px] font-mono text-muted-foreground">To change a special, delete it and publish a new one.</p>
            <Button type="submit" variant="secondary" className="w-full" disabled={create.isPending}>
              {create.isPending ? "Publishing…" : "Publish checked special"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
