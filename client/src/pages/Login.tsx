/**
 * Login page — New Lantern dark redesign.
 * Pure black canvas with hairline grid, single dark card, purple accent.
 * Figtree (headings/body) + Roboto Mono (overlines/labels) applied locally
 * so the rest of the app's typography is unaffected.
 * Auth logic is unchanged from the prior implementation.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock } from "lucide-react";
import { takeReturnTo } from "@/lib/returnTo";

const SANS = "'Figtree', 'Manrope', system-ui, sans-serif";
const MONO = "'Roboto Mono', ui-monospace, monospace";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Login failed");
      }

      const data = await response.json();

      // If the user arrived via a deep link, return them to it after login.
      const returnTo = takeReturnTo();
      if (returnTo) {
        window.location.href = returnTo;
        return;
      }

      if (data.clientSlug && data.orgSlug) {
        window.location.href = `/org/${data.clientSlug}/${data.orgSlug}`;
      } else if (data.orgSlug) {
        window.location.href = `/org/${data.orgSlug}`;
      } else {
        window.location.href = "/org/admin";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4 animate-page-in"
      style={{ background: "#000000", fontFamily: SANS }}
    >
      {/* Hairline grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 40%, #000 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 40%, #000 40%, transparent 100%)",
        }}
      />

      <div
        className="relative w-full max-w-lg rounded-2xl p-8 sm:p-12"
        style={{
          background: "#0B0B0C",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Logo + wordmark */}
        <div className="flex items-center gap-2.5">
          <img
            src="/images/flame-icon.png"
            alt="New Lantern"
            className="h-7 w-7 object-contain"
          />
          <span className="text-base font-semibold text-white">New Lantern</span>
        </div>

        {/* Overline */}
        <p
          className="mt-10 uppercase"
          style={{
            fontFamily: MONO,
            fontSize: "12px",
            letterSpacing: "0.18em",
            color: "#A855D9",
          }}
        >
          Customer Implementation Portal
        </p>

        {/* Heading */}
        <h1
          className="mt-4 leading-[1.05] tracking-tight"
          style={{ fontFamily: SANS, fontWeight: 800, fontSize: "clamp(2.25rem, 5vw, 3.25rem)" }}
        >
          <span className="text-white">Sign in to your</span>
          <br />
          <span style={{ color: "#7C1EBD" }}>onboarding workspace</span>
        </h1>

        <p className="mt-5 text-base leading-relaxed" style={{ color: "#8B8B90" }}>
          Track your implementation, share files, and look up answers — all in one
          place.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          {error && (
            <Alert
              variant="destructive"
              className="bg-red-950/40 border-red-500/40 animate-in fade-in-0 slide-in-from-top-1 duration-200"
            >
              <AlertDescription className="text-red-200 text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2.5">
            <Label htmlFor="email" className="text-white text-sm font-semibold">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@organization.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-14 rounded-xl border-white/[0.08] bg-[#111113] px-5 text-base text-white placeholder:text-[#5A5A60] focus-visible:border-[#7C1EBD] focus-visible:ring-[#7C1EBD]/25 transition-colors"
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="password" className="text-white text-sm font-semibold">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-14 rounded-xl border-white/[0.08] bg-[#111113] px-5 text-base text-white placeholder:text-[#5A5A60] focus-visible:border-[#7C1EBD] focus-visible:ring-[#7C1EBD]/25 transition-colors"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-14 rounded-lg text-base font-semibold text-white border-0 transition-colors"
            style={{ background: "#7C1EBD" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#8F4FBD")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#7C1EBD")}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Access Portal
          </Button>

          <div className="text-center">
            <Link href="/forgot-password">
              <button
                type="button"
                className="uppercase transition-colors hover:text-[#A855D9]"
                style={{
                  fontFamily: MONO,
                  fontSize: "12px",
                  letterSpacing: "0.12em",
                  color: "#6B6B70",
                }}
              >
                Forgot Password?
              </button>
            </Link>
          </div>
        </form>

        <div
          className="mt-8 pt-6 text-center text-sm"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", color: "#8B8B90" }}
        >
          Need assistance?{" "}
          <a
            href="mailto:support@newlantern.ai"
            className="font-medium transition-colors hover:text-[#A855D9]"
            style={{ color: "#7C1EBD" }}
          >
            Contact Support
          </a>
        </div>
      </div>

      {/* Footer — retains PHI handling notice */}
      <div
        className="absolute bottom-5 left-0 right-0 text-center uppercase"
        style={{
          fontFamily: MONO,
          fontSize: "12px",
          letterSpacing: "0.08em",
          color: "#4A4A50",
        }}
      >
        New Lantern © — Protected health information handling applies
      </div>
    </div>
  );
}
