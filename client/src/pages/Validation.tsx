/**
 * Validation Checklist Page - Static UI with mock data
 * Grouped by phase, each test has expected/actual results, pass/fail, sign-off
 * Right sidebar: Donut summary, Blockers, Next Steps
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, AlertTriangle, ShieldCheck } from "lucide-react";
import { useRoute, Link } from "wouter";

// ── Status badge ───────────────────────────────────────────────────────────────
function TestStatusBadge({ status }: { status: "Pass" | "Fail" | "Not Tested" | "Pending" }) {
  const styles: Record<string, string> = {
    Pass: "bg-green-500/20 text-green-400 border-green-500/30",
    Fail: "bg-red-500/20 text-red-400 border-red-500/30",
    "Not Tested": "bg-muted text-muted-foreground border-border",
    Pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${styles[status]}`}>
      {status}
    </Badge>
  );
}

// ── Mock data ──────────────────────────────────────────────────────────────────
interface TestCase {
  name: string;
  expected: string;
  actual: string;
  status: "Pass" | "Fail" | "Not Tested" | "Pending";
  signOff?: string;
}

interface Phase {
  title: string;
  tests: TestCase[];
}

const phases: Phase[] = [
  {
    title: "Connectivity Validation",
    tests: [
      { name: "VPN Tunnel Connectivity", expected: "Bidirectional ping < 50ms", actual: "12ms avg", status: "Pass", signOff: "J. Smith, Mar 18" },
      { name: "DICOM Echo Test (C-ECHO)", expected: "Success response from all AE titles", actual: "4/4 AE titles responding", status: "Pass", signOff: "J. Smith, Mar 18" },
      { name: "HL7 Port Connectivity", expected: "ACK received on all ports", actual: "ACK on ports 2575, 2576, 2577", status: "Pass", signOff: "J. Smith, Mar 18" },
    ],
  },
  {
    title: "HL7 Message Validation",
    tests: [
      { name: "ORM New Order (NW)", expected: "Order appears in worklist within 5s", actual: "Order received in 2.1s", status: "Pass", signOff: "A. Chen, Mar 22" },
      { name: "ORM Cancel Order (CA)", expected: "Order removed from worklist", actual: "Order cancelled successfully", status: "Pass", signOff: "A. Chen, Mar 22" },
      { name: "ORU Report Delivery", expected: "Report delivered to EHR within 10s", actual: "Timeout after 30s", status: "Fail" },
      { name: "ADT Patient Update", expected: "Demographics updated in PACS", actual: "-", status: "Not Tested" },
      { name: "Priority Routing (STAT)", expected: "STAT orders flagged in worklist", actual: "-", status: "Not Tested" },
    ],
  },
  {
    title: "Image Routing Validation",
    tests: [
      { name: "DICOM Store from Modality", expected: "Images arrive in < 30s", actual: "-", status: "Not Tested" },
      { name: "Prior Image Query/Retrieve", expected: "Priors available within 60s", actual: "-", status: "Not Tested" },
      { name: "Worklist (MWL) Query", expected: "Scheduled exams returned", actual: "-", status: "Not Tested" },
      { name: "AI Routing (if applicable)", expected: "Images routed to AI engine", actual: "-", status: "Not Tested" },
    ],
  },
  {
    title: "User Acceptance Testing",
    tests: [
      { name: "End-to-End Order Workflow", expected: "Order → Image → Report complete", actual: "-", status: "Not Tested" },
      { name: "Radiologist Reading Workflow", expected: "Study opens, report dictated, signed", actual: "-", status: "Not Tested" },
      { name: "Tech QC Workflow", expected: "Tech can reject/accept images", actual: "-", status: "Not Tested" },
      { name: "Report Distribution", expected: "Final report reaches referring provider", actual: "-", status: "Not Tested" },
      { name: "STAT Escalation Path", expected: "Critical results alert fires", actual: "-", status: "Not Tested" },
      { name: "Downtime Recovery", expected: "Queued studies process after reconnect", actual: "-", status: "Not Tested" },
    ],
  },
];

export default function Validation() {
  const [, params] = useRoute("/org/:slug/validation");
  const orgSlug = params?.slug || "demo";

  const allTests = phases.flatMap((p) => p.tests);
  const passed = allTests.filter((t) => t.status === "Pass").length;
  const failed = allTests.filter((t) => t.status === "Fail").length;
  const pending = allTests.filter((t) => t.status === "Not Tested" || t.status === "Pending").length;
  const total = allTests.length;
  const passPct = Math.round((passed / total) * 100);

  const blockers = allTests.filter((t) => t.status === "Fail");

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pass":
        return <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />;
      case "Fail":
        return <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/flame-icon.png" alt="New Lantern" className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Validation Checklist</h1>
              <p className="text-xs text-muted-foreground">PACS Onboarding</p>
            </div>
          </div>
          <Link href={`/org/${orgSlug}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Left column — Test phases */}
          <div className="space-y-6">
            {/* Progress header */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {passed} of {total} tests passed
                  </span>
                </div>
                <span className="text-sm font-bold text-primary">{passPct}%</span>
              </div>
              <Progress value={passPct} className="h-2" />
            </div>

            {/* Phases */}
            {phases.map((phase, pIdx) => {
              const phasePassed = phase.tests.filter((t) => t.status === "Pass").length;
              const phaseTotal = phase.tests.length;
              const phaseFailed = phase.tests.filter((t) => t.status === "Fail").length;
              const phaseNotStarted = phase.tests.filter((t) => t.status === "Not Tested").length;

              let phaseLabel = `${phasePassed}/${phaseTotal} Passed`;
              let phaseLabelStyle = "border-green-500/40 text-green-400";
              if (phaseNotStarted === phaseTotal) {
                phaseLabel = "0/" + phaseTotal + " Not Started";
                phaseLabelStyle = "border-border text-muted-foreground";
              } else if (phaseFailed > 0) {
                phaseLabel = `${phasePassed}/${phaseTotal} Passed`;
                phaseLabelStyle = "border-amber-500/40 text-amber-400";
              }

              return (
                <Card key={pIdx} className="border-border/50 overflow-hidden">
                  {/* Phase header */}
                  <div className="px-5 py-3 bg-muted/30 border-b border-border/40">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wider">
                        Phase {pIdx + 1}: {phase.title}
                      </h3>
                      <Badge variant="outline" className={`text-xs ${phaseLabelStyle}`}>
                        {phaseLabel}
                      </Badge>
                    </div>
                  </div>

                  {/* Test rows */}
                  <CardContent className="p-0">
                    {/* Column headers */}
                    <div className="hidden md:grid grid-cols-[auto_1fr_1fr_1fr_80px_1fr] gap-2 px-5 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/20 bg-muted/10">
                      <div className="w-5" />
                      <div>Test</div>
                      <div>Expected</div>
                      <div>Actual</div>
                      <div className="text-center">Result</div>
                      <div>Sign-Off</div>
                    </div>

                    {phase.tests.map((test, tIdx) => (
                      <div
                        key={tIdx}
                        className={`grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_1fr_80px_1fr] gap-2 items-center px-5 py-3 ${
                          tIdx < phase.tests.length - 1 ? "border-b border-border/20" : ""
                        } ${test.status === "Pass" ? "opacity-70" : ""}`}
                      >
                        {getStatusIcon(test.status)}

                        {/* Mobile: stacked labels */}
                        <div className="md:hidden space-y-1 ml-8">
                          <p className="text-sm font-medium">{test.name}</p>
                          <p className="text-xs text-muted-foreground">Expected: {test.expected}</p>
                          <p className="text-xs text-muted-foreground">Actual: {test.actual}</p>
                          <div className="flex items-center gap-2">
                            <TestStatusBadge status={test.status} />
                            {test.signOff && <span className="text-xs text-muted-foreground">{test.signOff}</span>}
                          </div>
                        </div>

                        {/* Desktop: grid columns */}
                        <span className="hidden md:block text-sm font-medium truncate">{test.name}</span>
                        <span className="hidden md:block text-xs text-muted-foreground">{test.expected}</span>
                        <span className="hidden md:block text-xs text-muted-foreground">{test.actual}</span>
                        <div className="hidden md:flex justify-center">
                          <TestStatusBadge status={test.status} />
                        </div>
                        <span className="hidden md:block text-xs text-muted-foreground">
                          {test.signOff || (test.status === "Not Tested" ? "Pending" : "-")}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            <Card className="border-border/50 sticky top-8">
              <CardContent className="p-5 space-y-6">
                {/* Validation Summary */}
                <h3 className="font-bold text-base">Validation Summary</h3>

                {/* Donut chart - CSS only */}
                <div className="flex justify-center">
                  <div className="relative w-36 h-36">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      {/* Background ring */}
                      <circle
                        cx="18" cy="18" r="15.9155"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="3"
                      />
                      {/* Failed segment */}
                      <circle
                        cx="18" cy="18" r="15.9155"
                        fill="none"
                        stroke="hsl(0 70% 50%)"
                        strokeWidth="3"
                        strokeDasharray={`${(failed / total) * 100} ${100 - (failed / total) * 100}`}
                        strokeDashoffset={`${-(passed / total) * 100}`}
                      />
                      {/* Passed segment */}
                      <circle
                        cx="18" cy="18" r="15.9155"
                        fill="none"
                        stroke="hsl(142 70% 45%)"
                        strokeWidth="3"
                        strokeDasharray={`${(passed / total) * 100} ${100 - (passed / total) * 100}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">{passPct}%</span>
                      <span className="text-xs text-muted-foreground">Passed</span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span>Passed ({passPct}%)</span>
                    </div>
                    <span className="font-medium">{passed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>Failed ({Math.round((failed / total) * 100)}%)</span>
                    </div>
                    <span className="font-medium">{failed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                      <span>Pending ({Math.round((pending / total) * 100)}%)</span>
                    </div>
                    <span className="font-medium">{pending}</span>
                  </div>
                </div>

                {/* Blockers */}
                {blockers.length > 0 && (
                  <div className="border-t border-border/40 pt-4 space-y-3">
                    <h4 className="font-bold text-sm flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      Blockers
                    </h4>
                    {blockers.map((b, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {b.name} — {b.actual || "requires investigation"}
                      </p>
                    ))}
                  </div>
                )}

                {/* Next Steps */}
                <div className="border-t border-border/40 pt-4 space-y-3">
                  <h4 className="font-bold text-sm">Next Steps</h4>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      Complete HL7 message testing
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      Begin image routing tests
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      Resolve ORU Report Delivery timeout
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
