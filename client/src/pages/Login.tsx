/**
 * Login page - dark purple background with IMPLEMENTATION focus
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        credentials: "include", // Important: include cookies
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Login failed");
      }

      const data = await response.json();
      
      // Hard reload to ensure cookie is properly set
      if (data.orgSlug) {
        window.location.href = `/org/${data.orgSlug}`;
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%)"
      }}
    >
      <Card className="w-full max-w-md border-purple-500/20 bg-black">
        <CardHeader className="space-y-6 pb-8">
          <div className="flex flex-col items-center gap-0.5">
            {/* New Lantern Logo */}
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-60 w-60 object-contain" />
            
            {/* Main Heading */}
            <h1 className="text-4xl font-bold text-center leading-tight">
              <span className="text-white">Customer</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-purple-400 bg-clip-text text-transparent">
                Implementation Portal
              </span>
            </h1>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="bg-red-950/50 border-red-500/50">
                <AlertDescription className="text-red-200">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-200">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-purple-950/30 border-purple-500/30 text-white placeholder:text-gray-500 focus:border-purple-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-200">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-purple-950/30 border-purple-500/30 text-white placeholder:text-gray-500 focus:border-purple-400"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold py-6 text-lg"
              disabled={isLoading}
            >
              {isLoading && (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              )}
              Access Portal
            </Button>

            <div className="text-center mt-4">
              <Link href="/forgot-password">
                <Button variant="link" className="text-purple-300 hover:text-purple-200 p-0 h-auto text-sm">
                  Forgot Password?
                </Button>
              </Link>
            </div>
          </form>

          <div className="mt-8 text-center text-sm text-gray-400 border-t border-purple-500/20 pt-6">
            <p>
              Need assistance?{" "}
              <a
                href="mailto:support@newlantern.ai"
                className="text-purple-400 hover:text-purple-300 font-medium"
              >
                Contact Support
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Copyright footer */}
      <div className="absolute bottom-4 text-center w-full">
        <p className="text-xs text-purple-400/60">New Lantern ©</p>
      </div>
      
      {/* PHI Disclaimer - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0">
        <PhiDisclaimer />
      </div>
    </div>
  );
}
