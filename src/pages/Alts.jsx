import { Layers } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export function Alts() {
  return (
    <ComingSoon
      icon={Layers}
      module="Alts"
      tagline="One place for all your alternative investments"
      description="Track capital calls, distributions, and exits per investment. Compute IRR via XIRR. Maintain a calendar of expected events. Sleeve mode for high-level projection, investment mode for precision."
      phase="Phase 4"
    />
  );
}
