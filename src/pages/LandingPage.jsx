import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, GraduationCap, BarChart3, Layers, ArrowRight } from "lucide-react";
import { EmailAuthForm } from "@/components/EmailAuthForm";

const PILLARS = [
  {
    title: "Invest, don't save",
    body: "Savings accounts lose to inflation. Every dollar should be working.",
  },
  {
    title: "Time is the asset",
    body: "Compounding rewards the patient. The plan you start now is worth more than the perfect plan started later.",
  },
  {
    title: "Plan the whole family",
    body: "College, alternatives, equities — these aren't separate. They're one picture.",
  },
  {
    title: "Think in decades",
    body: "Short-term noise is irrelevant. Build a model that holds over 20 years.",
  },
];

const MODULES = [
  {
    icon: BarChart3,
    key: "retirement",
    label: "Retirement",
    tagline: "Retirement income across every sleeve",
    description:
      "Model how your Alpha, Index, Alts, and College residual combine into a single income projection. See the crossover year — when passive income meets your target.",
  },
  {
    icon: GraduationCap,
    key: "college",
    label: "College",
    tagline: "Endowment-style funding for your children",
    description:
      "Multi-child planner with year-by-year projections, cost tier scenarios, and contribution modeling. Know exactly how funded each child's education is.",
  },
  {
    icon: Layers,
    key: "alts",
    label: "Alts",
    tagline: "One place for all your alternative investments",
    description:
      "Track capital calls, distributions, and exits. Compute IRR via XIRR. Maintain a calendar of expected events. The alts ecosystem is fragmented — this isn't.",
  },
  {
    icon: TrendingUp,
    key: "equity",
    label: "Equity",
    tagline: "Portfolio modeling and dividend tracking",
    description:
      "Holdings, projected growth, and a dedicated dividends sub-view. See annual income by holding, yield on cost, and forward projections.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Build your holistic money view",
    body: "Pick the areas that matter to you — retirement, college, alts, or all of it.",
  },
  {
    n: "2",
    title: "Answer a few quick questions",
    body: "Only the details your chosen modules actually need. Nothing more.",
  },
  {
    n: "3",
    title: "See the whole picture",
    body: "Every module feeds one dashboard. One answer.",
  },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function SignInBlock({ onGoogleSignIn, onLinkSent }) {
  return (
    <div className="w-full max-w-sm mx-auto space-y-4">
      <Button onClick={onGoogleSignIn} className="w-full gap-2">
        <GoogleIcon />
        Continue with Google
      </Button>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <EmailAuthForm onLinkSent={onLinkSent} />
    </div>
  );
}

export function LandingPage({ onGoogleSignIn, onLinkSent }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur px-6 h-14 flex items-center justify-between">
        <span className="font-heading font-bold text-lg tracking-tight">Holistic</span>
        <Button onClick={onGoogleSignIn} size="sm" className="gap-2">
          <GoogleIcon />
          <span className="hidden sm:inline">Sign in</span>
        </Button>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1
          className="font-heading font-bold tracking-tight text-foreground mb-6"
          style={{ fontSize: "clamp(36px, 6vw, 64px)", lineHeight: 1.1 }}
        >
          Your holistic
          <br />
          money view.
        </h1>
        <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
          Alternative investments, college funding, retirement — modeled together so you
          can see the whole picture.
        </p>
        <SignInBlock onGoogleSignIn={onGoogleSignIn} onLinkSent={onLinkSent} />
      </section>

      {/* Philosophy */}
      <section className="bg-muted/30 border-y py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2
            className="font-heading font-bold text-foreground text-center mb-12"
            style={{ fontSize: "clamp(22px, 3vw, 32px)" }}
          >
            The philosophy
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {PILLARS.map((p) => (
              <Card key={p.title} className="border-border">
                <CardContent className="pt-6">
                  <h3 className="font-heading font-semibold text-foreground mb-2">
                    {p.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">{p.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Module previews */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2
          className="font-heading font-bold text-foreground text-center mb-12"
          style={{ fontSize: "clamp(22px, 3vw, 32px)" }}
        >
          What's inside
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {MODULES.map(({ icon: Icon, key, label, tagline, description }) => (
            <Card key={key} className="border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-foreground text-sm">
                      {label}
                    </h3>
                    <p className="text-primary text-xs font-medium">{tagline}</p>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/30 border-y py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2
            className="font-heading font-bold text-foreground mb-12"
            style={{ fontSize: "clamp(22px, 3vw, 32px)" }}
          >
            How it works
          </h2>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {STEPS.map((step, i) => (
              <div key={step.n} className="flex items-center gap-4 flex-1">
                <div className="flex flex-col items-center text-center gap-2 flex-1">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm font-heading shrink-0">
                    {step.n}
                  </div>
                  <h3 className="font-heading font-semibold text-foreground text-sm">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-xs">{step.body}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2
          className="font-heading font-bold text-foreground mb-4"
          style={{ fontSize: "clamp(22px, 3vw, 32px)" }}
        >
          Ready to see the whole picture?
        </h2>
        <p className="text-muted-foreground mb-8">
          One login. All your plans. No subscriptions.
        </p>
        <SignInBlock onGoogleSignIn={onGoogleSignIn} onLinkSent={onLinkSent} />
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        A personal finance tool — not financial advice.
      </footer>
    </div>
  );
}
