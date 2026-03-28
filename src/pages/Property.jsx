import { Building2 } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export function Property() {
  return (
    <ComingSoon
      icon={Building2}
      module="Property"
      tagline="Real estate equity, income, and appreciation"
      description="Track holdings, rental income, mortgage paydown, and appreciation over time. Feeds projected income into your retirement Overview alongside every other sleeve."
      phase="v2"
    />
  );
}
