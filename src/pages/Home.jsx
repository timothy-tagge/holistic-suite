import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  GraduationCap,
  Layers,
  TrendingUp,
  Building2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const MODULES = [
  {
    key: "overview",
    label: "Overview",
    href: "/overview",
    icon: BarChart3,
    description: "Retirement income projection across every sleeve.",
    built: true,
  },
  {
    key: "college",
    label: "College",
    href: "/college",
    icon: GraduationCap,
    description: "Endowment-style funding plan for multiple children.",
    built: true,
  },
  {
    key: "alts",
    label: "Alts",
    href: "/alts",
    icon: Layers,
    description: "Capital calls, distributions, IRR — all in one place.",
    built: true,
  },
  {
    key: "equity",
    label: "Equity",
    href: "/equity",
    icon: TrendingUp,
    description: "Portfolio modeling, holdings, and dividend tracking.",
    built: false,
  },
  {
    key: "property",
    label: "Property",
    href: "/property",
    icon: Building2,
    description: "Real estate equity, income, and appreciation.",
    built: false,
  },
];

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:px-6">
      {/* Page title */}
      <div className="mb-10">
        <h1
          className="font-heading font-bold tracking-tight text-foreground"
          style={{ fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.15 }}
        >
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your financial picture at a glance.
        </p>
      </div>

      {/* Getting started / empty state */}
      <div className="mb-10 rounded-xl border bg-muted/30 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-heading font-semibold text-foreground mb-1">
              Welcome — let's get you set up
            </h2>
            <p className="text-muted-foreground text-sm mb-4">
              Open a module to start building your plan. Each one feeds the
              dashboard as you add data.
            </p>
            <Button onClick={() => navigate("/overview")} size="sm" className="gap-2">
              Start with Overview <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Module cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map(({ key, label, href, icon: Icon, description, built }) => (
          <Card
            key={key}
            className={[
              "border transition-shadow",
              built
                ? "cursor-pointer hover:shadow-md"
                : "opacity-60",
            ].join(" ")}
            onClick={built ? () => navigate(href) : undefined}
            role={built ? "button" : undefined}
            tabIndex={built ? 0 : undefined}
            onKeyDown={built ? (e) => e.key === "Enter" && navigate(href) : undefined}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="font-heading text-base font-semibold text-foreground">
                    {label}
                  </CardTitle>
                </div>
                {!built && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    Soon
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{description}</p>
              {built && (
                <div className="mt-3 flex items-center gap-1 text-primary text-xs font-medium">
                  Open <ArrowRight className="h-3 w-3" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
