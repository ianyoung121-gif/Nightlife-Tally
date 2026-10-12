import { Mail, ShieldCheck } from "lucide-react";

const supportEmail = "ianyoung121@hotmail.com";

export function Support() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      <header className="space-y-3 border-b border-border/60 pb-8">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">Support</p>
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">We’re here for your night out.</h1>
        <p className="text-muted-foreground">
          Need help with The Weekender, your data, or a venue? Send us a note and include the app version and your device model when you can.
        </p>
      </header>

      <a
        className="flex items-center justify-between gap-4 rounded-2xl border border-primary/40 bg-primary/10 p-6 transition-colors hover:bg-primary/20"
        href={`mailto:${supportEmail}`}
      >
        <span className="flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">
            <Mail className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Email support</span>
            <span className="mt-1 block text-lg font-bold text-white">{supportEmail}</span>
          </span>
        </span>
        <span className="font-mono text-xs uppercase tracking-wider text-accent">Write us</span>
      </a>

      <div className="flex gap-4 rounded-2xl border border-border/70 bg-card/50 p-6">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <p className="leading-7 text-muted-foreground">
          For an account or privacy question, include the email address used to sign in with Replit and tell us which part of the app you were using. To delete an account, use the in-app Profile screen or the public account deletion page. We do not keep a drink history linked to your profile. Billing questions about a venue subscription can be managed through the billing portal on the owner dashboard, and push alerts are an Android app feature.
        </p>
      </div>
    </div>
  );
}