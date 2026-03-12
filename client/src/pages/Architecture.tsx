/**
 * Architecture Page - Static UI
 * Standalone page for architecture diagram upload and systems inventory
 * Matches the top half of the IntegrationWorkflows mockup
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CloudUpload, FileText, Plus, Trash2, CheckCircle2, ArrowLeft } from "lucide-react";
import { useRoute, Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

// System types and colors (consistent with IntegrationWorkflows)
const SYSTEM_TYPES = ["RIS", "PACS", "VNA", "Interface Engine", "AI", "EHR", "Router", "Other"] as const;

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

// Mock systems data
interface System {
  id: string;
  name: string;
  type: string;
  vendor: string;
  version: string;
  notes: string;
}

const mockSystems: System[] = [
  { id: "1", name: "Epic Radiant", type: "RIS", vendor: "Epic Systems", version: "2024", notes: "Primary RIS for all sites" },
  { id: "2", name: "Sectra PACS", type: "PACS", vendor: "Sectra", version: "22.1", notes: "Current PACS being replaced" },
  { id: "3", name: "Mirth Connect", type: "Interface Engine", vendor: "NextGen", version: "4.4", notes: "HL7 routing and transformation" },
  { id: "4", name: "Epic EHR", type: "EHR", vendor: "Epic Systems", version: "2024", notes: "Hospital-wide EHR" },
  { id: "5", name: "Hologic", type: "Other", vendor: "Hologic", version: "-", notes: "Mammography workstation" },
];

export default function Architecture() {
  const [, params] = useRoute("/org/:slug/architecture");
  const orgSlug = params?.slug || "demo";
  const [diagramUploaded] = useState(true); // Mock: diagram already uploaded

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/flame-icon.png" alt="New Lantern" className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Architecture & Systems</h1>
              <p className="text-xs text-muted-foreground">Integration Workflows — Part 1 of 2</p>
            </div>
          </div>
          <Link href={`/org/${orgSlug}/intake`} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Back to Intake
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Completion status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border bg-green-500/10 text-green-500 border-green-500/30">
            <CheckCircle2 className="w-4 h-4" />
            2/2 Complete
          </div>
          <span className="text-sm text-muted-foreground">Architecture diagram uploaded, systems inventory populated</span>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Architecture Diagram */}
          <Card className="border-border/50">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base">Architecture Diagram</h3>
                {diagramUploaded && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                    Uploaded
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Upload a network or workflow diagram showing how orders, images, priors, and reports move through your systems.
              </p>

              {diagramUploaded ? (
                <div className="space-y-3">
                  {/* Mock uploaded diagram preview */}
                  <div className="rounded-lg overflow-hidden border bg-muted/20 aspect-video flex items-center justify-center">
                    <div className="text-center p-8">
                      <div className="w-16 h-16 mx-auto mb-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-primary" />
                      </div>
                      <p className="text-sm font-medium">network-architecture-v2.png</p>
                      <p className="text-xs text-muted-foreground mt-1">Uploaded: Mar 8, 2026</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">network-architecture-v2.png</p>
                      <p className="text-xs text-muted-foreground">1.2 MB • Uploaded Mar 8, 2026</p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Replace functionality coming soon")}>
                      <CloudUpload className="w-3.5 h-3.5" />
                      Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  <CloudUpload className="w-8 h-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Drop file here or click to upload</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, PDF accepted</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Systems Inventory */}
          <Card className="border-border/50">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base">Systems in Your Environment</h3>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  {mockSystems.length} Systems
                </Badge>
              </div>

              {/* Systems table */}
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">System</th>
                      <th className="text-left px-3 py-2 font-medium w-32">Type</th>
                      <th className="text-left px-3 py-2 font-medium">Vendor</th>
                      <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">Notes</th>
                      <th className="w-8 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {mockSystems.map((sys, idx) => (
                      <tr key={sys.id} className={`border-t border-border/40 ${idx % 2 === 1 ? "bg-muted/10" : ""}`}>
                        <td className="px-3 py-2.5 font-medium">{sys.name}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[sys.type] || TYPE_COLORS.Other}`}>
                            {sys.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{sys.vendor}</td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs hidden lg:table-cell">{sys.notes}</td>
                        <td className="px-2 py-2.5 text-center">
                          <button
                            onClick={() => toast.info("Delete functionality coming soon")}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => toast.info("Add system functionality coming soon")}>
                <Plus className="w-4 h-4" />
                Add System
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Continue to Workflows */}
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          <Link href={`/org/${orgSlug}/intake`}>
            <Button variant="ghost" className="gap-2 text-primary hover:text-primary">
              <ArrowLeft className="w-4 h-4" />
              Back to Intake
            </Button>
          </Link>
          <Link href={`/org/${orgSlug}/workflows`}>
            <Button className="gap-2">
              Continue to Workflows
              <span className="text-xs opacity-70">→</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
