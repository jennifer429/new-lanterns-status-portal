import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { useOrgParams } from "@/hooks/useOrgParams";

export default function IntakeComplete() {
  const { orgPath } = useOrgParams("complete");
  const [, setLocation] = useLocation();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: "linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%)"
      }}
    >
      <Card className="max-w-lg w-full border-purple-500/20 bg-black/60 backdrop-blur-sm">
        <CardContent className="p-10 text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-500/20 p-4">
              <CheckCircle2 className="w-12 h-12 text-green-400" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Intake Complete</h1>
            <p className="text-muted-foreground">
              Your responses have been submitted. Our team will review everything and reach out with next steps.
            </p>
          </div>

          <div className="pt-4 space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation(`${orgPath}/intake`)}
            >
              Review My Responses
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
