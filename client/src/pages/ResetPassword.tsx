/**
 * Reset Password Page (direct reset with email)
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Get email from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(emailParam);
    } else {
      setError("Invalid reset link");
    }
  }, []);

  const resetMutation = trpc.auth.resetPasswordDirect.useMutation({
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (err: { message: string }) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    resetMutation.mutate({ email, newPassword });
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
            <img src="/images/new-lantern-logo-hires.png" alt="New Lantern" className="h-16 w-16 object-contain" />
            
            {/* Small New Lantern Copyright */}
            <div className="text-xs text-purple-900 font-medium tracking-wide">
              New Lantern ©
            </div>
            
            {/* Main Heading */}
            <h1 className="text-3xl font-bold text-center leading-tight">
              <span className="text-white">Create New</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-purple-400 bg-clip-text text-transparent">
                Password
              </span>
            </h1>
            <CardDescription className="text-gray-300 text-center">
              Enter your new password below
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-6">
              <Alert className="bg-green-950/50 border-green-500/50">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-100">
                  Password has been reset successfully. You can now log in with your new password.
                </AlertDescription>
              </Alert>
              <Link href="/login">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400">
                  Go to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="bg-red-950/50 border-red-500/50">
                  <AlertDescription>{error}</AlertDescription>
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
                  disabled
                  className="bg-black/30 border-purple-500/30 text-gray-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-gray-200">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                  className="bg-black/30 border-purple-500/30 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-200">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  className="bg-black/30 border-purple-500/30 text-white placeholder:text-gray-500"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-medium"
                disabled={resetMutation.isPending || !email}
              >
                {resetMutation.isPending ? "Resetting..." : "Reset Password"}
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
