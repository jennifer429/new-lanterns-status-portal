/**
 * Specifications — read-only page for hospital/org users to browse and download
 * New Lantern PACS specification documents uploaded by admins.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  Download,
  FileText,
  Search,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { UserMenu } from "@/components/UserMenu";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";

export default function Specifications() {
  const [, params] = useRoute("/org/:slug/specs");
  const orgSlug = params?.slug || "";

  const { data: organization } = trpc.organizations.getBySlug.useQuery(
    { slug: orgSlug },
    { enabled: !!orgSlug }
  );
  const { data: specs = [], isLoading } =
    trpc.admin.getSpecifications.useQuery();

  const [search, setSearch] = useState("");

  // Group specs by category
  const filteredSpecs = useMemo(() => {
    if (!search.trim()) return specs;
    const q = search.toLowerCase();
    return specs.filter(
      (s: any) =>
        s.title.toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q) ||
        (s.category || "").toLowerCase().includes(q)
    );
  }, [specs, search]);

  const categories = useMemo(() => {
    const cats = new Map<string, any[]>();
    for (const spec of filteredSpecs) {
      const cat = (spec as any).category || "General";
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat)!.push(spec);
    }
    return cats;
  }, [filteredSpecs]);

  const orgName = organization?.name || "Your Organization";

  return (
    <div className="min-h-screen bg-background animate-page-in">
      {/* ── Glass Header ── */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/images/new-lantern-logo.png"
              alt="New Lantern"
              className="h-8 shrink-0"
            />
            <div className="hidden sm:block border-l border-border/40 pl-3 min-w-0">
              <div className="text-sm font-semibold tracking-tight truncate">Specifications</div>
              {orgName && <div className="text-xs text-muted-foreground truncate">{orgName}</div>}
            </div>
            <div className="sm:hidden text-sm font-semibold truncate max-w-[120px]">{orgName}</div>
          </div>
          <div className="flex items-center gap-3">
            <UserMenu />
          </div>
        </div>
      </header>
      <PageBreadcrumb orgSlug={orgSlug} items={[{ label: "Specifications" }]} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ── Title ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
                <BookOpen className="w-6 h-6 text-primary" />
                New Lantern Specifications
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Technical documentation and reference materials for your PACS
                implementation
              </p>
            </div>
          </div>
        </div>

        {/* ── Search ── */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search specifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        )}

        {/* ── Empty State ── */}
        {!isLoading && specs.length === 0 && (
          <Card className="card-elevated">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-2xl bg-primary/10 mb-4">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">
                No Specifications Available
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Specification documents will appear here once your New Lantern
                team uploads them. Check back soon.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── No Results ── */}
        {!isLoading && specs.length > 0 && filteredSpecs.length === 0 && (
          <Card className="card-elevated">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No specifications match "{search}"
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setSearch("")}
              >
                Clear search
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Specs by Category ── */}
        {!isLoading &&
          Array.from(categories.entries()).map(([category, catSpecs]) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-1"
                >
                  {category}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {catSpecs.length} document{catSpecs.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid gap-3">
                {catSpecs.map((spec: any) => (
                  <Card
                    key={spec.id}
                    className="card-elevated hover:border-primary/30 transition-all group"
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors shrink-0 mt-0.5">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold leading-snug">
                              {spec.title}
                            </h3>
                            {spec.description && (
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                {spec.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2.5 text-xs text-muted-foreground/70">
                              {spec.fileName && (
                                <span className="truncate max-w-[200px]">
                                  {spec.fileName}
                                </span>
                              )}
                              {spec.fileSize && (
                                <span>
                                  {(spec.fileSize / 1024).toFixed(0)} KB
                                </span>
                              )}
                              {spec.createdAt && (
                                <span>
                                  {new Date(
                                    spec.createdAt
                                  ).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <a
                          href={spec.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                            <ExternalLink className="w-3 h-3 opacity-50" />
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

        <div className="h-8" />
      </div>
    </div>
  );
}
