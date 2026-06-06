import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ContactsTable } from "./ContactsTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Download,
  FileIcon,
  Loader2,
  Upload,
  AlertCircle,
} from "lucide-react";
import { type Question } from "@shared/questionnaireData";
import { cn } from "@/lib/utils";
import { UploadedFilesList } from "@/components/UploadedFileRow";
import { LocalInput } from "./LocalFormControls";
import { LocalTextarea } from "./LocalFormControls";

interface QuestionRendererProps {
  question: Question;
  responses: Record<string, any>;
  setResponses: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  uploadingFiles: Set<string>;
  allUploadedFiles: Array<{
    id: number;
    questionId: string;
    fileName: string;
    fileUrl: string;
    fileSize?: number | null;
    mimeType?: string | null;
    createdAt?: string | Date | null;
    uploadedBy?: string | null;
  }>;
  dbTemplateMap: Map<string, Array<{ label: string; fileName: string; fileUrl: string }>>;
  onFileUpload: (questionId: string, file: File) => void;
  onFileDelete: (fileId: number) => void;
  slug: string;
  isFileDeleting: boolean;
  naQuestions?: Set<string>;
  toggleQuestionNa?: (questionId: string) => void;
}

export function QuestionRenderer({
  question,
  responses,
  setResponses,
  uploadingFiles,
  allUploadedFiles,
  dbTemplateMap,
  onFileUpload,
  onFileDelete,
  slug,
  isFileDeleting,
  naQuestions = new Set(),
  toggleQuestionNa,
}: QuestionRendererProps) {
  const value = responses[question.id];
  const isUploading = uploadingFiles.has(question.id);
  const isNa = naQuestions.has(question.id);
  const isEmpty = !isNa && !value && value !== 0 && (!Array.isArray(value) || value.length === 0);

  switch (question.type) {
    case "text":
      return (
        <div className="relative">
          <LocalInput
            value={value || ""}
            onCommit={(val) =>
              setResponses((prev) => ({ ...prev, [question.id]: val }))
            }
            placeholder={question.placeholder}
            className="!bg-white !text-black"
          />
          {isEmpty && !isNa && (
            <div className="absolute -left-6 top-1/2 -translate-y-1/2">
              <AlertCircle className="w-4 h-4 text-red-500" title="Unanswered" />
            </div>
          )}
          {isNa && (
            <div className="absolute -left-6 top-1/2 -translate-y-1/2">
              <CheckCircle2 className="w-4 h-4 text-gray-400" title="Marked N/A" />
            </div>
          )}
        </div>
      );

    case "textarea":
      return (
        <div className="relative">
          <LocalTextarea
            value={value || ""}
            onCommit={(val) =>
              setResponses((prev) => ({ ...prev, [question.id]: val }))
          }
            placeholder={question.placeholder}
            className="!bg-white !text-black min-h-[100px]"
          />
          {isEmpty && !isNa && (
            <div className="absolute -left-6 top-3">
              <AlertCircle className="w-4 h-4 text-red-500" title="Unanswered" />
            </div>
          )}
          {isNa && (
            <div className="absolute -left-6 top-3">
              <CheckCircle2 className="w-4 h-4 text-gray-400" title="Marked N/A" />
            </div>
          )}
        </div>
      );

    case "dropdown":
      return (
        <div className="relative">
          <Select
            value={value || ""}
            onValueChange={(val) =>
              setResponses((prev) => ({ ...prev, [question.id]: val }))
            }
          >
            <SelectTrigger className="!bg-white !text-black">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isEmpty && !isNa && (
            <div className="absolute -left-6 top-1/2 -translate-y-1/2">
              <AlertCircle className="w-4 h-4 text-red-500" title="Unanswered" />
            </div>
          )}
          {isNa && (
            <div className="absolute -left-6 top-1/2 -translate-y-1/2">
              <CheckCircle2 className="w-4 h-4 text-gray-400" title="Marked N/A" />
            </div>
          )}
        </div>
      );

    case "date":
      return (
        <LocalInput
          type="date"
          value={value || ""}
          onCommit={(val) =>
            setResponses((prev) => ({ ...prev, [question.id]: val }))
          }
          className="!bg-white !text-black"
        />
      );

    case "multi-select":
      return (
        <div className="flex flex-wrap gap-2">
          {question.options?.map((opt) => {
            const checked = Array.isArray(value) && value.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const current = Array.isArray(value) ? value : [];
                  const updated = checked
                    ? current.filter((v) => v !== opt)
                    : [...current, opt];
                  setResponses((prev) => ({ ...prev, [question.id]: updated }));
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  checked
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );

    case "upload":
    case "upload-download": {
      // Render inline file upload for upload and upload-download questions.
      const inlineTemplates = dbTemplateMap.get(question.id) || [];
      const questionFiles = allUploadedFiles.filter(
        (f) => f.questionId === question.id
      );
      const uploadInputRef = { current: null as HTMLInputElement | null };

      return (
        <div className="space-y-2">
          {/* Template download buttons */}
          {inlineTemplates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {inlineTemplates.map((tmpl, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = tmpl.fileUrl;
                    link.download = tmpl.fileName;
                    link.click();
                  }}
                  className="text-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {tmpl.label} ({tmpl.fileName})
                </Button>
              ))}
            </div>
          )}

          {/* Upload button row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {questionFiles.length > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" />{" "}
                  {questionFiles.length} file
                  {questionFiles.length !== 1 ? "s" : ""} uploaded
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <FileIcon className="w-3.5 h-3.5" /> No file uploaded
                </span>
              )}
            </div>
            <div>
              <input
                ref={uploadInputRef}
                type="file"
                className="hidden"
                accept={question.acceptTypes || undefined}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Validate file type if acceptTypes is specified
                    if (question.acceptTypes) {
                      const allowedExts = question.acceptTypes
                        .split(",")
                        .map((ext) => ext.trim().toLowerCase());
                      const fileExt =
                        "." + file.name.split(".").pop()?.toLowerCase();
                      if (!allowedExts.includes(fileExt)) {
                        alert(
                          `Only ${allowedExts.join(", ")} files are accepted for this upload.`
                        );
                        e.target.value = "";
                        return;
                      }
                    }
                    onFileUpload(question.id, file);
                  }
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isUploading}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-1.5" /> Upload
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Clean vertical file list with preview/download/remove */}
          {questionFiles.length > 0 && (
            <UploadedFilesList
              files={questionFiles.map((f) => ({
                id: f.id,
                fileName: f.fileName,
                fileUrl: f.fileUrl,
                fileSize: f.fileSize,
                createdAt: f.createdAt,
                uploadedBy: f.uploadedBy,
              }))}
              onRemove={(fileId) => onFileDelete(fileId)}
              isRemoving={isFileDeleting}
              compact
            />
          )}
        </div>
      );
    }

    case "contacts-table": {
      // Dynamic contacts from Notion Contacts v2 database (via MySQL cache).
      // No hardcoded slots — displays whatever roles exist for this org.
      return <ContactsTable slug={slug} />;
    }

    default:
      return null;
  }
}
