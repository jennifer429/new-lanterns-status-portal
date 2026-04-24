import { Link } from "wouter";
import { Download, Menu, Upload } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { questionnaireSections } from "@shared/questionnaireData";
import type { Section } from "@shared/questionnaireData";

interface IntakeHeaderProps {
  slug: string;
  clientSlug: string;
  orgName?: string;
  orgClientName?: string;
  onOpenSidebar: () => void;
  onExport: () => void;
  onOpenImport: () => void;
  calculateSectionProgress: (section: Section) => number;
  fileCount: number;
}

export function IntakeHeader({
  slug,
  clientSlug,
  orgName,
  orgClientName,
  onOpenSidebar,
  onExport,
  onOpenImport,
  calculateSectionProgress,
  fileCount,
}: IntakeHeaderProps) {
  return (
    <>
      {/* Sticky top header */}
      <header className="border-b border-purple-500/20 bg-black/40 backdrop-blur-md sticky top-0 z-30">
        <div className="px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden text-muted-foreground hover:text-white flex-shrink-0"
              onClick={onOpenSidebar}
            >
              <Menu className="w-6 h-6" />
            </button>
            <img
              src="/images/new-lantern-logo.png"
              alt="New Lantern"
              className="h-8 flex-shrink-0 hidden md:block"
            />
            <div className="hidden sm:block border-l border-border/40 pl-3 min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">Questionnaire</div>
              {orgName && (
                <div className="text-xs text-muted-foreground truncate">
                  {orgName}
                  {orgClientName ? ` · ${orgClientName}` : ""}
                </div>
              )}
            </div>
            {orgName && (
              <div className="sm:hidden text-sm font-semibold truncate max-w-[110px]">
                {orgName
                  .split(" ")
                  .map((w: string) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 4)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={clientSlug ? `/org/${clientSlug}/${slug}` : `/org/${slug}`}
              className="text-sm text-foreground hover:text-primary transition-colors font-medium whitespace-nowrap"
            >
              Site Dashboard
            </Link>
            <UserMenu
              extraItems={[
                {
                  label: "Export",
                  icon: <Download className="w-4 h-4 mr-2" />,
                  onClick: onExport,
                },
                {
                  label: "Import",
                  icon: <Upload className="w-4 h-4 mr-2" />,
                  onClick: onOpenImport,
                },
              ]}
            />
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <PageBreadcrumb orgSlug={slug} items={[{ label: "Questionnaire" }]} />

      {/* Overall Stats Banner */}
      <div className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 border-b border-purple-500/20 px-4 md:px-8 py-3 md:py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Sections Completed</div>
              <div className="text-base md:text-lg font-bold">
                {questionnaireSections.filter((s) => calculateSectionProgress(s) === 100).length}{" "}
                of {questionnaireSections.length}
              </div>
            </div>
            <div className="hidden sm:block h-12 w-px bg-border" />
            <div>
              <div className="text-sm text-muted-foreground mb-1">Files Uploaded</div>
              <div className="text-base md:text-lg font-bold">{fileCount} files</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
