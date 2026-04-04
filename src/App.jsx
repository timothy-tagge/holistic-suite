import { Routes, Route, Navigate } from "react-router-dom";
import { useProfile } from "@/contexts/useProfile";
import { Home } from "@/pages/Home";
import { Onboarding } from "@/pages/Onboarding";
import { Overview } from "@/pages/Overview";
import { Retirement } from "@/pages/Retirement";
import { College } from "@/pages/College";
import { Alts } from "@/pages/Alts";
import { Dividends } from "@/pages/Dividends";
import { Equity } from "@/pages/Equity";
import { Property } from "@/pages/Property";
import { Profile } from "@/pages/Profile";

function AppRoutes() {
  const { isOnboarded, profileLoading, nextSetupModule } = useProfile();

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm gap-2">
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            animation: "spin 0.7s linear infinite",
            opacity: 0.4,
          }}
        />
        Loading…
      </div>
    );
  }

  // Route unboarded users to onboarding, allow /onboarding itself
  if (!isOnboarded) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          nextSetupModule ? <Navigate to={`/${nextSetupModule}`} replace /> : <Home />
        }
      />
      <Route path="/overview" element={<Overview />} />
      <Route path="/retirement" element={<Retirement />} />
      <Route path="/college" element={<College />} />
      <Route path="/alts" element={<Alts />} />
      <Route path="/dividends" element={<Dividends />} />
      <Route path="/equity" element={<Equity />} />
      <Route path="/property" element={<Property />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/onboarding" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
