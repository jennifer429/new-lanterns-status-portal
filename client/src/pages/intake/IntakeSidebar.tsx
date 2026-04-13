import { Link } from "wouter";
import { CheckCircle2, Circle, FileText, FileUp, Network, ClipboardCheck, X } from "lucide-react";
import { questionnaireSections } from "@shared/questionnaireData";
import type { Section } from "@shared/questionnaireData";

// Section icons mapping
const sectionIcons: Record<string, any> = {
  "org-info": FileText,
  "architecture": Network,
  "integration-workflows": Network,
  "connectivity": FileUp,
  "config-files": FileUp,
  "hl7-dicom": ClipboardCheck,
};

interface IntakeSidebarProps {
  clientSlug: string;
  slug: string;
  sidebarOpen: boolean;
  onClose: () => void;
  currentSection: string;
  onSectionChange: (sectionId: string) => void;
  calculateSectionProgress: (section: Section) => number;
  fileCount: number;
}

export function IntakeSidebar({
  clientSlug,
  slug,
  sidebarOpen,
  onClose,
  currentSection,
  onSectionChange,
  calculateSectionProgress,
  fileCount,
}: IntakeSidebarProps) {
  return (
    <div
      className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-black border-r border-purple-500/20 flex flex-col
        transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:static md:translate-x-0 md:shrink-0
      `}
    >
      {/* Logo - links back to dashboard */}
      <div className="p-6 border-b flex items-center justify-between">
        <Link href={clientSlug ? `/org/${clientSlug}/${slug}` : `/org/${slug}`}>
          <img
            src="/images/new-lantern-logo.png"
            alt="New Lantern"
            className="h-10 cursor-pointer hover:opacity-80 transition-opacity"
          />
        </Link>
        <button
          className="md:hidden text-muted-foreground hover:text-white p-1"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Overview Card */}
      <div className="p-4 border-b border-purple-500/20">
        <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 rounded-lg p-4 border border-purple-500/30">
          {/* Section completion count */}
          <div className="mb-3">
            <div className="text-xs text-muted-foreground mb-1">Overall Progress</div>
            <div className="text-lg font-bold text-white">
              {questionnaireSections.filter((s) => calculateSectionProgress(s) === 100).length} of{" "}
              {questionnaireSections.length} sections complete
            </div>
          </div>

          {/* Section Progress List */}
          <div className="space-y-2 mb-3">
            {questionnaireSections.map((section) => {
              const progress = calculateSectionProgress(section);
              const isComplete = progress === 100;
              return (
                <div key={section.id} className="flex items-center gap-2 text-xs">
                  {isComplete ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                  )}
                  <span
                    className={`truncate ${isComplete ? "text-green-400 font-medium" : "text-muted-foreground"}`}
                  >
                    {section.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Files Count */}
          <div className="pt-3 border-t border-purple-500/20">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Files Uploaded</span>
              <span className="font-bold text-white">{fileCount} files</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {questionnaireSections.map((section, index) => {
          const Icon = sectionIcons[section.id] || FileText;
          const progress = calculateSectionProgress(section);
          const isActive = currentSection === section.id;
          const isComplete = progress === 100;

          return (
            <button
              key={section.id}
              onClick={() => {
                onSectionChange(section.id);
                onClose();
              }}
              className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
              ) : (
                <Icon className="w-5 h-5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {index + 1}. {section.title}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
