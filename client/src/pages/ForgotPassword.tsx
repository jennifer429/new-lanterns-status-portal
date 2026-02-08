/**
 * Forgot Password page - Check email and redirect to reset or show support message
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const checkEmailMutation = trpc.auth.checkEmail.useMutation({
    onSuccess: (data) => {
      if (data.exists) {
        // Email exists - redirect to reset password page
        setLocation(`/reset-password?email=${encodeURIComponent(data.email)}`);
      } else {
        // Email doesn't exist
        const isNewLanternEmail = data.email.toLowerCase().endsWith('@newlantern.ai');
        if (isNewLanternEmail) {
          // New Lantern staff - redirect to create admin account
          setLocation(`/reset-password?email=${encodeURIComponent(data.email)}&create=true`);
        } else {
          // External user - show support message
          setError("Please contact New Lantern support");
        }
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    checkEmailMutation.mutate({ email });
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%)"
      }}
    >
      <Card className="w-full max-w-md border-purple-500/20 bg-black/40 backdrop-blur-xl">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="icon" className="text-purple-300 hover:text-purple-200">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <CardTitle className="text-2xl text-white">Forgot Password</CardTitle>
              <CardDescription className="text-purple-300 mt-1">
                Enter your email to reset your password
              </CardDescription>
            </div>
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

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold py-6 text-lg"
              disabled={checkEmailMutation.isPending}
            >
              {checkEmailMutation.isPending && (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              )}
              Continue
            </Button>

            <div className="text-center">
              <Link href="/login">
                <Button variant="link" className="text-purple-300 hover:text-purple-200">
                  Back to Login
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Copyright footer */}
      <div className="absolute bottom-4 text-center w-full">
        <p className="text-xs text-purple-400/60">New Lantern ©</p>
      </div>
    </div>
  );
}
