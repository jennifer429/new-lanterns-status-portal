import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
}: QuestionRendererProps) {
  const value = responses[question.id];
  const isUploading = uploadingFiles.has(question.id);

  switch (question.type) {
    case "text":
      return (
        <LocalInput
          value={value || ""}
          onCommit={(val) =>
            setResponses((prev) => ({ ...prev, [question.id]: val }))
          }
          placeholder={question.placeholder}
          className="!bg-white !text-black"
        />
      );

    case "textarea":
      return (
        <LocalTextarea
          value={value || ""}
          onCommit={(val) =>
            setResponses((prev) => ({ ...prev, [question.id]: val }))
          }
          placeholder={question.placeholder}
          className="!bg-white !text-black min-h-[100px]"
        />
      );

    case "dropdown":
      return (
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
      // `key` is the persisted JSON key (unchanged so existing data round-trips);
      // id/role/hint drive the display.
      const CONTACT_ROWS = [
        { key: "admin", id: "A.1", role: "Administrative", hint: "Primary admin / billing owner" },
        { key: "it", id: "A.2", role: "IT Connectivity", hint: "Network, VPN, firewall" },
        { key: "it_post_prod", id: "A.itpp", role: "IT Post-Production Support", hint: "Ongoing support after go-live" },
        { key: "clinical", id: "A.3", role: "Clinical", hint: "Workflow / department lead" },
        { key: "radiologist", id: "A.4", role: "Radiologist Champion", hint: "Reading physician sponsor" },
        { key: "pm", id: "A.5", role: "Project Manager", hint: "Implementation coordination" },
      ] as const;

      type ContactKey = (typeof CONTACT_ROWS)[number]["key"];
      type ContactRow = { name: string; phone: string; email: string };
      type ContactsData = Record<ContactKey, ContactRow>;

      const empty: ContactRow = { name: "", phone: "", email: "" };
      let parsed: ContactsData;
      try {
        parsed = value
          ? typeof value === "string"
            ? JSON.parse(value)
            : value
          : ({} as ContactsData);
      } catch {
        parsed = {} as ContactsData;
      }

      const isFilled = (r: ContactRow) =>
        (r.name || r.email || r.phone || "").trim() !== "";
      const filledCount = CONTACT_ROWS.filter(({ key }) =>
        isFilled({ ...empty, ...(parsed[key as ContactKey] || {}) })
      ).length;

      const updateContact = (
        rowKey: ContactKey,
        field: keyof ContactRow,
        val: string
      ) => {
        setResponses((prev) => {
          // Always read from latest state to avoid stale closure overwriting parallel edits
          const current = prev[question.id];
          let prevParsed: ContactsData;
          try {
            prevParsed = current
              ? typeof current === "string"
                ? JSON.parse(current)
                : current
              : ({} as ContactsData);
          } catch {
            prevParsed = {} as ContactsData;
          }

          const next: ContactsData = {
            ...prevParsed,
            [rowKey]: { ...empty, ...(prevParsed[rowKey] || {}), [field]: val },
          } as ContactsData;
          const hasContent = Object.values(next).some((r) =>
            Object.values(r as ContactRow).some(
              (v) => (v as string).trim() !== ""
            )
          );
          // Store as object — auto-save will JSON.stringify it
          return { ...prev, [question.id]: hasContent ? next : "" };
        });
      };

      const cellInputClass =
        "h-8 text-sm bg-transparent border-0 shadow-none rounded focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:bg-primary/5";

      return (
        <div className="col-span-2 rounded-lg border border-border overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
            <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
              {filledCount} of {CONTACT_ROWS.length} roles filled · syncs to Notion
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground w-64">
                    Role
                  </th>
                  <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Email
                  </th>
                  <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Phone
                  </th>
                </tr>
              </thead>
              <tbody>
                {CONTACT_ROWS.map(({ key, id, role, hint }, idx) => {
                  const row: ContactRow = {
                    ...empty,
                    ...(parsed[key as ContactKey] || {}),
                  };
                  const filled = isFilled(row);
                  return (
                    <tr key={key} className={idx % 2 === 1 ? "bg-muted/10" : ""}>
                      <td className="px-3 py-1.5 align-middle">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0 transition-colors",
                              filled ? "bg-emerald-500" : "bg-muted-foreground/30"
                            )}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{role}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{id} · {hint}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <LocalInput
                          value={row.name}
                          onCommit={(val) => updateContact(key as ContactKey, "name", val)}
                          placeholder="Full name"
                          className={cellInputClass}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <LocalInput
                          value={row.email}
                          onCommit={(val) => updateContact(key as ContactKey, "email", val)}
                          placeholder="email@org.com"
                          className={cn(cellInputClass, "font-mono")}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <LocalInput
                          value={row.phone}
                          onCommit={(val) => updateContact(key as ContactKey, "phone", val)}
                          placeholder="(000) 000-0000"
                          className={cn(cellInputClass, "font-mono")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
