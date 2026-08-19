import { Mail, MapPin, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

const supportEmail = "ianyoung121@hotmail.com";

export function Privacy() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <header className="space-y-3 border-b border-border/60 pb-8">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">Privacy</p>
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Your night out stays yours.</h1>
        <p className="max-w-2xl text-muted-foreground">
          The Weekender is built to help you find a venue and see the community pulse without turning your night into a personal consumption record.
        </p>
        <p className="font-mono text-xs text-muted-foreground">Last updated: August 19, 2026</p>
      </header>

      <PolicySection icon={MapPin} title="Location">
        Location is optional. If you enable it, The Weekender uses your device location to sort nearby venues and build local plans. Your location stays on your device and is not sent to the Weekender service.
      </PolicySection>

      <PolicySection icon={ShieldCheck} title="Accounts and community data">
        If you choose to sign in with Replit, The Weekender receives and stores the account information needed to operate your account, including your user ID, username, email address, and any profile image reference Replit provides. Community drink tallies are sent to the Weekender service only to update aggregate venue activity. The mobile tally flow does not attach a user ID to a tally or create a personal drinking history.
      </PolicySection>

      <PolicySection icon={ShieldCheck} title="How we use and protect data">
        We use account information to operate sign-in and follows, and anonymous tallies to show the community pulse at a venue. We do not sell personal data or use the current mobile app for advertising. The app uses encrypted HTTPS connections for its service requests. We do not include third-party advertising or analytics SDKs in the current mobile app.
      </PolicySection>

      <PolicySection icon={Mail} title="Your choices and contact">
        You can leave location disabled and still use other parts of the app. You can sign out at any time to remove the session from your device. To permanently delete your Weekender account, use the{" "}
        <Link href="/delete-account" className="text-accent underline decoration-accent/50 underline-offset-4 hover:text-white">account deletion page</Link>
        {" "}or the in-app Profile screen. For questions about privacy, your account, or anonymous community tallies, contact{" "}
        <a className="text-accent underline decoration-accent/50 underline-offset-4 hover:text-white" href={`mailto:${supportEmail}`}>
          {supportEmail}
        </a>.
      </PolicySection>

      <div className="rounded-xl border border-primary/30 bg-primary/10 p-5 font-mono text-xs leading-6 text-muted-foreground">
        The Weekender promotes responsible nights out. Plan a safe ride and never drink and drive.
      </div>
    </div>
  );
}

function PolicySection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/50 p-6 shadow-[0_0_30px_rgba(255,45,120,0.04)]">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      <p className="leading-7 text-muted-foreground">{children}</p>
    </section>
  );
}