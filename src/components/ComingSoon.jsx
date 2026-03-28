import { Badge } from "@/components/ui/badge";

export function ComingSoon({ icon: Icon, module, tagline, description, phase }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:px-6">
      {/* Page title */}
      <div className="mb-10">
        <h1
          className="font-heading font-bold tracking-tight text-foreground"
          style={{ fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.15 }}
        >
          {module}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{tagline}</p>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-heading font-semibold text-foreground text-xl">
            {module}
          </h2>
          <Badge variant="outline" className="text-xs">
            {phase}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm max-w-md">{description}</p>
      </div>
    </div>
  );
}
