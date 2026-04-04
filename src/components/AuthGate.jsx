import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import { useLocation } from "react-router-dom";
import { auth, googleProvider } from "@/firebase";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AppHeader } from "@/components/AppHeader";
import { LandingPage } from "@/pages/LandingPage";
import { VerifyEmail } from "@/pages/VerifyEmail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ConfirmEmailForLink({ onConfirm }) {
  const [email, setEmail] = useState("");
  return (
    <div className="min-h-svh bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-4">
        <h1 className="font-heading font-bold tracking-tight text-foreground text-xl">
          Confirm your email
        </h1>
        <p className="text-muted-foreground text-sm">
          You opened this sign-in link on a different device. Enter your email to complete
          sign-in.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-email" className="text-sm">
            Email
          </Label>
          <Input
            id="confirm-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        <Button
          className="w-full"
          disabled={!email.trim()}
          onClick={() => onConfirm(email.trim())}
        >
          Sign in
        </Button>
      </div>
    </div>
  );
}

function Shell({ user, children }) {
  const location = useLocation();
  // Onboarding gets no AppHeader — it's a full standalone flow
  const isOnboarding = location.pathname === "/onboarding";

  function handleSignOut() {
    signOut(auth).catch(console.error);
  }

  return (
    <div className="flex flex-col min-h-svh overflow-x-hidden w-full max-w-[100vw]">
      <AppHeader user={user} onSignOut={handleSignOut} minimal={isOnboarding} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

export function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(null);
  const [linkSignInEmail, setLinkSignInEmail] = useState(() => {
    // Detect incoming magic link synchronously at mount — avoids setState in effect
    if (!isSignInWithEmailLink(auth, window.location.href)) return null;
    const stored = window.localStorage.getItem("emailForSignIn");
    return stored ? null : "prompt"; // null = same-device (handled in effect below)
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  // Handle same-device magic link sign-in on page load
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    const stored = window.localStorage.getItem("emailForSignIn");
    if (!stored) return; // different-device case handled via linkSignInEmail initial state
    signInWithEmailLink(auth, stored, window.location.href)
      .then(() => {
        window.localStorage.removeItem("emailForSignIn");
        // Clean the link params from the URL without a reload
        window.history.replaceState(null, "", window.location.pathname);
      })
      .catch(console.error);
  }, []);

  function handleGoogleSignIn() {
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

  // Magic link sent — waiting for user to click it
  if (pendingVerificationEmail) {
    return (
      <VerifyEmail
        email={pendingVerificationEmail}
        onBack={() => setPendingVerificationEmail(null)}
      />
    );
  }

  // Magic link opened on a different device — need email to complete sign-in
  if (linkSignInEmail === "prompt") {
    return (
      <ConfirmEmailForLink
        onConfirm={(email) => {
          signInWithEmailLink(auth, email, window.location.href)
            .then(() => {
              window.localStorage.removeItem("emailForSignIn");
              window.history.replaceState(null, "", window.location.pathname);
              setLinkSignInEmail(null);
            })
            .catch(() => setLinkSignInEmail(null));
        }}
      />
    );
  }

  // Unauthenticated — show landing page
  if (!user) {
    return (
      <LandingPage
        onGoogleSignIn={handleGoogleSignIn}
        onLinkSent={(email) => setPendingVerificationEmail(email)}
      />
    );
  }

  // Authenticated — provide profile context and shell
  return (
    <ProfileProvider user={user}>
      <Shell user={user}>{children}</Shell>
    </ProfileProvider>
  );
}
