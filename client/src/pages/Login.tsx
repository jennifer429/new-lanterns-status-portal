/**
 * Login page - dark purple background with IMPLEMENTATION focus
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      // Redirect based on role and organization
      if (data.role === "admin") {
        setLocation("/admin");
      } else if (data.orgSlug) {
        setLocation(`/org/${data.orgSlug}`);
      } else {
        setLocation("/");
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ email, password });
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%)"
      }}
    >
      <Card className="w-full max-w-md border-purple-500/20 bg-black/40 backdrop-blur-xl">
        <CardHeader className="space-y-6 pb-8">
          <div className="flex flex-col items-center gap-3">
            {/* New Lantern Logo */}
            <img src="/images/flame-icon.png" alt="New Lantern" className="h-16 w-16 object-contain" />
            
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
                placeholder="your.email@hospital.org"
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

            <div className="flex justify-end">
              <Link href="/forgot-password">
                <Button variant="link" className="text-purple-300 hover:text-purple-200 p-0 h-auto text-sm">
                  Forgot Password?
                </Button>
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold py-6 text-lg"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending && (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              )}
              Access Portal
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-400 border-t border-purple-500/20 pt-6">
            <p>
              Need assistance?{" "}
              <a
                href="mailto:support@newlantern.com"
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
    </div>
  );
}
