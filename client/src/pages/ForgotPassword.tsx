/**
 * Forgot Password Page
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const resetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetMutation.mutate({ email });
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
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-16 w-16 object-contain" />
            
            {/* Small New Lantern Copyright */}
            <div className="text-xs text-purple-900 font-medium tracking-wide">
              New Lantern ©
            </div>
            
            {/* Main Heading */}
            <h1 className="text-3xl font-bold text-center leading-tight">
              <span className="text-white">Reset Your</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-purple-400 bg-clip-text text-transparent">
                Password
              </span>
            </h1>
            <CardDescription className="text-gray-300 text-center">
              Enter your email address and we'll send you a reset link
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-6">
              <Alert className="bg-green-950/50 border-green-500/50">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-100">
                  {resetMutation.data?.message}
                </AlertDescription>
              </Alert>
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {resetMutation.isError && (
                <Alert variant="destructive" className="bg-red-950/50 border-red-500/50">
                  <AlertDescription>
                    {resetMutation.error.message}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-200">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@hospital.org"
                  required
                  className="bg-black/30 border-purple-500/30 text-white placeholder:text-gray-500"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-medium"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? "Sending..." : "Send Reset Link"}
              </Button>

              <div className="text-center">
                <Link href="/login">
                  <Button variant="link" className="text-purple-300 hover:text-purple-200">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
