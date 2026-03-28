import { TrendingUp } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export function Equity() {
  return (
    <ComingSoon
      icon={TrendingUp}
      module="Equity"
      tagline="Portfolio modeling and dividend tracking"
      description="Holdings across stocks, index funds, and mutual funds. Projected growth, unrealized gains, and a dedicated dividends sub-view — yield on cost, annual income, and forward projections per holding."
      phase="v2"
    />
  );
}
