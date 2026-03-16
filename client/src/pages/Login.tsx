/**
 * Login page - dark purple background with IMPLEMENTATION focus
 * Polished: card glow, refined spacing, smooth entrance animation
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { PhiDisclaimer } from "@/components/PhiDisclaimer";

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
      
      if (data.orgSlug) {
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
      className="min-h-screen flex items-center justify-center p-4 animate-page-in"
      style={{
        background: "linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%)"
      }}
    >
      <Card className="w-full max-w-md border-purple-500/20 bg-black/90 shadow-[0_0_80px_-20px_rgba(147,51,234,0.25)]">
        <CardHeader className="space-y-4 pb-6 pt-8">
          <div className="flex flex-col items-center gap-1">
            {/* New Lantern Logo */}
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-28 w-28 sm:h-44 sm:w-44 object-contain drop-shadow-[0_0_20px_rgba(147,51,234,0.15)]" />

            {/* Main Heading */}
            <h1 className="text-2xl sm:text-4xl font-bold text-center leading-tight tracking-tight">
              <span className="text-white">Customer</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-purple-400 bg-clip-text text-transparent">
                Implementation Portal
              </span>
            </h1>
          </div>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="bg-red-950/50 border-red-500/50 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <AlertDescription className="text-red-200 text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300 text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-purple-950/30 border-purple-500/30 text-white placeholder:text-gray-500 focus:border-purple-400 focus:ring-purple-400/20 h-11 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300 text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-purple-950/30 border-purple-500/30 text-white placeholder:text-gray-500 focus:border-purple-400 focus:ring-purple-400/20 h-11 transition-colors"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold py-6 text-lg shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading && (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              )}
              Access Portal
            </Button>

            <div className="text-center mt-4">
              <Link href="/forgot-password">
                <Button variant="link" className="text-purple-300 hover:text-purple-200 p-0 h-auto text-sm font-medium">
                  Forgot Password?
                </Button>
              </Link>
            </div>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500 border-t border-purple-500/15 pt-6">
            <p>
              Need assistance?{" "}
              <a
                href="mailto:support@newlantern.ai"
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Contact Support
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Copyright footer */}
      <div className="absolute bottom-4 text-center w-full">
        <p className="text-xs text-purple-400/50 tracking-wide">New Lantern &copy;</p>
      </div>
      
      {/* PHI Disclaimer - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0">
        <PhiDisclaimer />
      </div>
    </div>
  );
}
