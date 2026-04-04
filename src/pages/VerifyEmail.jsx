import { useState } from "react";
import { sendSignInLinkToEmail } from "firebase/auth";
import { auth } from "@/firebase";
import { Button } from "@/components/ui/button";

const ACTION_CODE_SETTINGS = {
  url: window.location.origin,
  handleCodeInApp: true,
};

const RESEND_COOLDOWN = 60;

export function VerifyEmail({ email, onBack }) {
  const [cooldown, setCooldown] = useState(0);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleResend() {
    setError(null);
    try {
      await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS);
      window.localStorage.setItem("emailForSignIn", email);
      setSent(true);
      setCooldown(RESEND_COOLDOWN);
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setError("Couldn't resend — try again.");
    }
  }

  return (
    <div className="min-h-svh bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="space-y-2">
          <h1
            className="font-heading font-bold tracking-tight text-foreground"
            style={{ fontSize: "clamp(22px, 4vw, 30px)" }}
          >
            Check your email
          </h1>
          <p className="text-muted-foreground text-sm">
            We sent a sign-in link to{" "}
            <span className="font-medium text-foreground">{email}</span>.
            Click the link to sign in — no password needed.
          </p>
        </div>
        <div className="space-y-3">
          {sent && <p className="text-xs text-muted-foreground">Link resent.</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={cooldown > 0}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onBack}>
            Use a different email
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Can&apos;t find the email? Check your spam folder.
        </p>
      </div>
    </div>
  );
}
