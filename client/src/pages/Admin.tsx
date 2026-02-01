/**
 * Admin page for PM/Ops to create new hospital organizations
 * PM manually creates Linear issue, ClickUp list, and Google Drive folder first,
 * then enters the IDs here to link everything together
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Building2, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function Admin() {
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    startDate: "",
    goalDate: "",
    linearIssueId: "",
    clickupListId: "",
    googleDriveFolderId: "",
  });

  const [createdOrg, setCreatedOrg] = useState<{ slug: string; url: string } | null>(null);

  const createOrgMutation = trpc.organizations.create.useMutation({
    onSuccess: (data) => {
      const portalUrl = `${window.location.origin}/org/${data.slug}`;
      setCreatedOrg({ slug: data.slug, url: portalUrl });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrgMutation.mutate(formData);
  };

  const handleCopyUrl = () => {
    if (createdOrg) {
      navigator.clipboard.writeText(createdOrg.url);
    }
  };

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center gap-4">
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin Portal</h1>
              <p className="text-sm text-muted-foreground mt-1">Create new hospital organizations</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8 max-w-4xl">
        {/* Success Message */}
        {createdOrg && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">Organization Created!</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Share this URL with the hospital team to access their portal:
                  </p>
                  <div className="flex items-center gap-2">
                    <Input value={createdOrg.url} readOnly className="font-mono text-sm" />
                    <Button onClick={handleCopyUrl} variant="outline" size="sm">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href={createdOrg.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Setup Instructions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Setup Checklist</CardTitle>
            <CardDescription>Complete these steps before creating the organization</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <div>
                  <strong>Create Linear Issue:</strong> Create a new issue in Linear for this hospital
                  (e.g., "Memorial General Hospital - Implementation"). Copy the issue ID (e.g., "NL-123").
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <div>
                  <strong>Create ClickUp List:</strong> Create a dedicated list in ClickUp for this hospital's
                  tasks. Copy the list ID from the URL.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <div>
                  <strong>Create Google Drive Folder:</strong> Create a folder in Google Drive for this
                  hospital's files. Copy the folder ID from the URL.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <div>
                  <strong>Fill out the form below</strong> with hospital details and the IDs from steps 1-3.
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Organization Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Create New Organization
            </CardTitle>
            <CardDescription>Enter hospital details and integration IDs</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Hospital Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Hospital Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Hospital Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Memorial General Hospital"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="slug">URL Slug * (auto-generated)</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="memorial-general-hospital"
                      required
                      pattern="[a-z0-9-]+"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Portal URL: {window.location.origin}/org/{formData.slug || "..."}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="contactName">Contact Name</Label>
                    <Input
                      id="contactName"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      placeholder="Dr. Sarah Chen"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      placeholder="sarah.chen@hospital.org"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="goalDate">Goal Date</Label>
                    <Input
                      id="goalDate"
                      type="date"
                      value={formData.goalDate}
                      onChange={(e) => setFormData({ ...formData, goalDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Integration IDs */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Integration IDs</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="linearIssueId">Linear Issue ID</Label>
                    <Input
                      id="linearIssueId"
                      value={formData.linearIssueId}
                      onChange={(e) => setFormData({ ...formData, linearIssueId: e.target.value })}
                      placeholder="NL-123"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      For two-way communication between hospital and dev team
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="clickupListId">ClickUp List ID</Label>
                    <Input
                      id="clickupListId"
                      value={formData.clickupListId}
                      onChange={(e) => setFormData({ ...formData, clickupListId: e.target.value })}
                      placeholder="123456789"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      For PM task management and tracking
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="googleDriveFolderId">Google Drive Folder ID</Label>
                    <Input
                      id="googleDriveFolderId"
                      value={formData.googleDriveFolderId}
                      onChange={(e) => setFormData({ ...formData, googleDriveFolderId: e.target.value })}
                      placeholder="1a2b3c4d5e6f7g8h9i0j"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      For storing hospital's uploaded files
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Submit */}
              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={createOrgMutation.isPending || !formData.name || !formData.slug}
                >
                  {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
                </Button>
                {createOrgMutation.isError && (
                  <p className="text-sm text-red-400">
                    Error: {createOrgMutation.error.message}
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
