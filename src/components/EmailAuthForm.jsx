import { useState } from "react";
import {
  sendSignInLinkToEmail,
} from "firebase/auth";
import { auth } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ACTION_CODE_SETTINGS = {
  url: window.location.origin,
  handleCodeInApp: true,
};

export function EmailAuthForm({ onLinkSent }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendSignInLinkToEmail(auth, email.trim(), ACTION_CODE_SETTINGS);
      window.localStorage.setItem("emailForSignIn", email.trim());
      onLinkSent(email.trim());
    } catch (err) {
      if (err.code === "auth/too-many-requests") {
        setError("Too many requests. Try again later.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Network error. Check your connection and try again.");
      } else {
        setError("Couldn't send the link. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 w-full">
      <div className="space-y-1.5">
        <Label htmlFor="auth-email" className="text-sm">Email</Label>
        <Input
          id="auth-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
        {loading ? "Sending…" : "Send sign-in link"}
      </Button>
    </form>
  );
}
