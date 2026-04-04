import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { useLocation } from "react-router-dom";
import { auth, googleProvider } from "@/firebase";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AppHeader } from "@/components/AppHeader";
import { LandingPage } from "@/pages/LandingPage";

function Shell({ user, children }) {
  const location = useLocation();
  // Onboarding gets no AppHeader — it's a full standalone flow
  const isOnboarding = location.pathname === "/onboarding";

  function handleSignOut() {
    signOut(auth).catch(console.error);
  }

  if (isOnboarding) return children;

  return (
    <div className="flex flex-col min-h-svh overflow-x-hidden w-full max-w-[100vw]">
      <AppHeader user={user} onSignOut={handleSignOut} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

export function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  function handleSignIn() {
    signInWithPopup(auth, googleProvider).catch(console.error);
  }

  // Still resolving Firebase auth
  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-svh text-muted-foreground text-sm gap-2">
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

  // Unauthenticated — show landing page
  if (!user) {
    return <LandingPage onSignIn={handleSignIn} />;
  }

  // Authenticated — provide profile context and shell
  return (
    <ProfileProvider user={user}>
      <Shell user={user}>{children}</Shell>
    </ProfileProvider>
  );
}
