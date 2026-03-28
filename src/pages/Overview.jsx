import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export function Overview() {
  return (
    <ComingSoon
      icon={BarChart3}
      module="Overview"
      tagline="Retirement income projection"
      description="Model projected income across every sleeve — Alpha, Index, Alts, College residual, and Dividends — stacked in one chart. See the crossover year where passive income meets your target."
      phase="Phase 2"
    />
  );
}
