import { GraduationCap } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export function College() {
  return (
    <ComingSoon
      icon={GraduationCap}
      module="College"
      tagline="Endowment-style funding for your children"
      description="Multi-child planner with year-by-year projections, configurable cost tiers, contribution strategies, and a true residual that flows into your retirement income model."
      phase="Phase 3"
    />
  );
}
