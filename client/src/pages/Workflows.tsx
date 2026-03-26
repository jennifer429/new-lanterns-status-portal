/**
 * Workflows Page - Static UI
 * Standalone page for the 4 workflow descriptions (Orders, Images, Priors, Reports)
 * Matches the bottom half of the IntegrationWorkflows mockup
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle, ArrowLeft, ArrowRight } from "lucide-react";
import { useRoute, Link } from "wouter";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";

// System type colors (consistent with Architecture page)
const TYPE_COLORS: Record<string, string> = {
  EHR: "bg-violet-500/20 text-violet-300 border border-violet-500/40",
  RIS: "bg-teal-500/20 text-teal-300 border border-teal-500/40",
  PACS: "bg-blue-500/20 text-blue-300 border border-blue-500/40",
  "Interface Engine": "bg-green-500/20 text-green-300 border border-green-500/40",
  AI: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40",
  VNA: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40",
  Router: "bg-orange-500/20 text-orange-300 border border-orange-500/40",
  Other: "bg-gray-500/20 text-gray-300 border border-gray-500/40",
};

// Mock workflow data
interface WorkflowData {
  id: string;
  label: string;
  description: string;
  content: string;
  systems: { name: string; type: string }[];
  filled: boolean;
}

const workflows: WorkflowData[] = [
  {
    id: "orders",
    label: "Orders Workflow",
    description: "Describe how imaging orders reach the platform.",
    content: "Orders originate in Epic Radiant, sent via HL7 ORM through Mirth Connect interface engine. Mirth transforms and routes to New Lantern PACS. Order updates (cancel, modify) follow the same path. STAT orders are flagged with priority S in OBR:27.1.",
    systems: [
      { name: "Epic Radiant", type: "RIS" },
      { name: "Mirth Connect", type: "Interface Engine" },
    ],
    filled: true,
  },
  {
    id: "images",
    label: "Images Workflow",
    description: "Describe how imaging studies are routed.",
    content: "Studies acquired on modalities (CT, MR, XR, US) are sent via DICOM C-STORE to Sectra PACS, which then forwards to New Lantern via DICOM C-STORE over VPN. Mammography images route from Hologic workstation directly.",
    systems: [
      { name: "Sectra PACS", type: "PACS" },
      { name: "Hologic", type: "Other" },
    ],
    filled: true,
  },
  {
    id: "priors",
    label: "Priors Workflow",
    description: "Describe how prior studies are retrieved.",
    content: "New Lantern queries Sectra PACS via C-FIND/C-MOVE for relevant prior studies when a new order arrives. Priors are matched by MRN (PID:3.1). VNA is queried as fallback for studies older than 2 years.",
    systems: [
      { name: "Sectra PACS", type: "PACS" },
      { name: "VNA Archive", type: "VNA" },
    ],
    filled: true,
  },
  {
    id: "reports",
    label: "Reports Workflow",
    description: "Describe how reports are delivered back.",
    content: "",
    systems: [],
    filled: false,
  },
];

export default function Workflows() {
  const [, params] = useRoute("/org/:slug/workflows");
  const orgSlug = params?.slug || "demo";

  const filledCount = workflows.filter((w) => w.filled).length;
  const totalCount = workflows.length;
  const allComplete = filledCount === totalCount;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/images/flame-icon.png" alt="New Lantern" className="h-7 w-7 shrink-0" />
            <div className="hidden sm:block border-l border-border/40 pl-3 min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">Data Flow Workflows</div>
              <p className="text-xs text-muted-foreground">Integration Workflows</p>
            </div>
          </div>
          <Link href={`/org/${orgSlug}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Link>
        </div>
      </header>
      <PageBreadcrumb orgSlug={orgSlug} items={[{ label: "Workflows" }]} />

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Completion status */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
              allComplete
                ? "bg-green-500/10 text-green-500 border-green-500/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {allComplete && <CheckCircle2 className="w-4 h-4" />}
            {filledCount}/{totalCount} Complete
          </div>
          <span className="text-sm text-muted-foreground">
            Describe how data flows through each pathway
          </span>
        </div>

        {/* Workflow blocks — 2x2 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {workflows.map((wf) => (
            <Card
              key={wf.id}
              className={`border-border/50 transition-colors ${
                wf.filled ? "border-primary/30" : ""
              }`}
            >
              <CardContent className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2">
                  {wf.filled ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
                  )}
                  <h3 className="font-bold text-base">{wf.label}</h3>
                </div>

                <p className="text-sm text-muted-foreground">{wf.description}</p>

                {/* Content area */}
                {wf.filled ? (
                  <div className="rounded-lg bg-muted/20 border border-border/40 p-4">
                    <p className="text-sm leading-relaxed">{wf.content}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed border-border/40 p-4 min-h-[100px] flex items-center justify-center">
                    <p className="text-sm text-muted-foreground italic">
                      No description provided yet
                    </p>
                  </div>
                )}

                {/* Systems involved */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Systems Involved
                  </p>
                  {wf.systems.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {wf.systems.map((sys) => (
                        <span
                          key={sys.name}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            TYPE_COLORS[sys.type] || TYPE_COLORS.Other
                          }`}
                        >
                          {sys.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No systems selected</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Flow summary */}
        <Card className="border-border/50 bg-muted/10">
          <CardContent className="p-5">
            <h3 className="font-bold text-base mb-4">Data Flow Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  className={`text-center p-3 rounded-lg border ${
                    wf.filled
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/40 bg-muted/20"
                  }`}
                >
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    {wf.label.replace(" Workflow", "")}
                  </p>
                  <p className="text-sm font-medium">
                    {wf.filled ? `${wf.systems.length} systems` : "Not defined"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Navigation footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          <Link href={`/org/${orgSlug}/architecture`}>
            <Button variant="ghost" className="gap-2 text-primary hover:text-primary">
              <ArrowLeft className="w-4 h-4" />
              Back to Architecture
            </Button>
          </Link>
          <Link href={`/org/${orgSlug}/intake`}>
            <Button className="gap-2">
              Back to Intake Overview
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
