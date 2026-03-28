import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { useLocation } from "react-router-dom";
import { auth, googleProvider } from "@/firebase";
import { AppHeader } from "@/components/AppHeader";
import { LandingPage } from "@/pages/LandingPage";

export function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const location = useLocation();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  function handleSignIn() {
    signInWithPopup(auth, googleProvider).catch(console.error);
  }

  function handleSignOut() {
    signOut(auth).catch(console.error);
  }

  // Still resolving auth state
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

  // Unauthenticated — show landing page (no header)
  if (!user) {
    return <LandingPage onSignIn={handleSignIn} />;
  }

  // Authenticated — wrap children with AppHeader
  return (
    <div className="flex flex-col min-h-svh">
      <AppHeader
        user={user}
        onSignOut={handleSignOut}
      />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
