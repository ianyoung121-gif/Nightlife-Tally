import { ShieldAlert, Trash2 } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";

export function DeleteAccount() {
  const { user, isLoading, login, deleteAccount } = useAuth();

  const removeAccount = async () => {
    if (!window.confirm("Delete your Weekender account, saved follows, and every active session? This cannot be undone.")) return;
    try {
      await deleteAccount();
      window.location.assign("/");
    } catch {
      window.alert("We could not delete your account. Please try again or contact support.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      <header className="space-y-3 border-b border-border/60 pb-8">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-destructive">Account deletion</p>
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Delete your account.</h1>
        <p className="text-muted-foreground">
          This permanently removes your Weekender account, saved follows, and all active sessions. Anonymous community tally totals are not linked to your account and remain as aggregate venue activity.
        </p>
      </header>

      <div className="flex gap-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-6">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <p className="leading-7 text-muted-foreground">
          You must be signed in to confirm deletion. Signing out only removes the session from your device; deletion removes the stored account data.
        </p>
      </div>

      {!isLoading && (user ? (
        <Button variant="destructive" size="lg" onClick={() => void removeAccount()} className="gap-2">
          <Trash2 className="h-4 w-4" />
          Delete my account
        </Button>
      ) : (
        <Button size="lg" onClick={login}>Log in to delete your account</Button>
      ))}
    </div>
  );
}