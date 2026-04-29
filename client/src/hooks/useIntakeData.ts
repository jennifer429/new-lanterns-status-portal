import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  questionnaireSections,
  type Question,
  type Section,
} from "@shared/questionnaireData";
import { type ConnectivityRow } from "@/components/ConnectivityTable";
import { useAuth } from "@/_core/hooks/useAuth";

export function useIntakeData(slug: string, clientSlug: string) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [responses, setResponses] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [naQuestions, setNaQuestions] = useState<Set<string>>(new Set());
  const [connRows, setConnRows] = useState<ConnectivityRow[]>([]);
  const notionPageIds = useRef<Set<string>>(new Set());

  // ── tRPC queries ─────────────────────────────────────────────────────────────

  const { data: org } = trpc.organizations.getBySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );

  const { data: existingResponses, isLoading: orgLoading } =
    trpc.intake.getResponses.useQuery(
      { organizationSlug: slug || "" },
      { enabled: !!slug }
    );

  const { data: fileCount = 0 } = trpc.intake.getFileCount.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  const { data: allUploadedFiles = [] } = trpc.intake.getAllUploadedFiles.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  // Notion connectivity — live read/write
  const { data: notionConnData } = trpc.connectivity.getForOrg.useQuery(
    { organizationSlug: slug || "", organizationName: org?.name },
    { enabled: !!slug && !!org }
  );

  const { data: dbTemplates = [] } = trpc.intake.getTemplatesForOrg.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  // ── tRPC mutations ───────────────────────────────────────────────────────────

  const utils = trpc.useUtils();

  const saveMutation = trpc.intake.saveResponse.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: (error) => {
      // Silent save failures used to leave users typing into the void when the
      // URL slug didn't match any org (e.g. an org renamed in admin without
      // updating its slug). Surface them so the problem is visible.
      setSaveStatus("idle");
      const msg =
        error.data?.code === "NOT_FOUND"
          ? `Couldn't save — this org URL doesn't match any record. Slug may have been renamed.`
          : error.data?.code === "FORBIDDEN"
            ? `Couldn't save — you don't have access to this org.`
            : `Couldn't save your changes: ${error.message}`;
      toast.error("Save failed", { description: msg });
    },
  });

  const submitFeedbackMutation = trpc.intake.submitFeedback.useMutation({
    onSuccess: () => {
      const completePath = clientSlug
        ? `/org/${clientSlug}/${slug}/complete`
        : `/org/${slug}/complete`;
      setLocation(completePath);
    },
    onError: () => {
      toast.error("Failed to submit feedback. Please try again.");
    },
  });

  const uploadMutation = trpc.intake.uploadFile.useMutation({
    onSuccess: (_, variables) => {
      setUploadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(variables.questionId);
        return next;
      });
      utils.intake.getUploadedFiles.invalidate({
        organizationSlug: slug || "",
        questionId: variables.questionId,
      });
      utils.intake.getAllUploadedFiles.invalidate({
        organizationSlug: slug || "",
      });
      utils.intake.getFileCount.invalidate({
        organizationSlug: slug || "",
      });
    },
    onError: (error, variables) => {
      setUploadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(variables.questionId);
        return next;
      });
      console.error("File upload failed:", error);
      alert(`File upload failed: ${error.message}. Please try again.`);
    },
  });

  const deleteMutation = trpc.intake.deleteFile.useMutation({
    onSuccess: () => {
      utils.intake.getUploadedFiles.invalidate();
      utils.intake.getAllUploadedFiles.invalidate({
        organizationSlug: slug || "",
      });
      utils.intake.getFileCount.invalidate({
        organizationSlug: slug || "",
      });
    },
  });

  const createConnRow = trpc.connectivity.createRow.useMutation();
  const updateConnRow = trpc.connectivity.updateRow.useMutation();
  const archiveConnRow = trpc.connectivity.archiveRow.useMutation();

  // ── Derived state ────────────────────────────────────────────────────────────

  // Build a map of questionId -> template(s) from database
  const dbTemplateMap = useMemo(() => {
    const map = new Map<
      string,
      Array<{ label: string; fileName: string; fileUrl: string }>
    >();
    dbTemplates.forEach((t) => {
      const existing = map.get(t.questionId) || [];
      existing.push({ label: t.label, fileName: t.fileName, fileUrl: t.fileUrl });
      map.set(t.questionId, existing);
    });
    return map;
  }, [dbTemplates]);

  // Create a map of questionId -> file count for validation
  const uploadedFilesMap = useMemo(() => {
    const map = new Map<string, number>();
    allUploadedFiles.forEach((file) => {
      const count = map.get(file.questionId) || 0;
      map.set(file.questionId, count + 1);
    });
    return map;
  }, [allUploadedFiles]);

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Seed connectivity rows from Notion on load
  // DATA-LOSS SAFEGUARD: Never overwrite existing rows with empty data from
  // a Notion error response. Only replace rows when Notion returns actual data,
  // or when the table was previously empty (initial load).
  useEffect(() => {
    if (notionConnData?.rows && notionConnData.rows.length > 0) {
      // Notion returned real data — use it
      setConnRows(notionConnData.rows as ConnectivityRow[]);
      notionPageIds.current = new Set(
        notionConnData.rows.map((r: any) => r.id)
      );
    } else if (notionConnData !== undefined && !notionConnData?.error) {
      // Notion returned empty with NO error — only load local fallback if
      // we don't already have rows (prevents wiping user-entered data)
      setConnRows((prev) => {
        if (prev.length > 0) return prev; // preserve existing rows
        try {
          const v = responses["CONN.endpoints"];
          if (v) {
            const parsed = typeof v === "string" ? JSON.parse(v) : v;
            return Array.isArray(parsed) ? parsed : prev;
          }
        } catch {
          /* ignore */
        }
        return prev;
      });
    }
    // If notionConnData has an error, do nothing — keep existing rows intact
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notionConnData]);

  // Load existing responses into state
  useEffect(() => {
    if (existingResponses) {
      const loadedResponses: Record<string, any> = {};
      existingResponses.forEach((resp) => {
        // Skip responses with null questionId (orphaned data)
        if (!resp.questionId) return;
        try {
          const value =
            typeof resp.response === "string"
              ? JSON.parse(resp.response)
              : resp.response;
          loadedResponses[resp.questionId] = value;
        } catch {
          loadedResponses[resp.questionId] = resp.response;
        }
      });
      setResponses(loadedResponses);

      // Load N/A question state from saved responses
      const loadedNa = new Set<string>();
      Object.keys(loadedResponses).forEach((key) => {
        if (key.startsWith("__question_na:")) {
          const qId = key.replace("__question_na:", "");
          if (
            loadedResponses[key] === "true" ||
            loadedResponses[key] === true
          ) {
            loadedNa.add(qId);
          }
        }
      });
      setNaQuestions(loadedNa);
    }
  }, [existingResponses]);

  // Auto-save on response change
  useEffect(() => {
    if (!slug || Object.keys(responses).length === 0) return;

    const timer = setTimeout(() => {
      setSaveStatus("saving");
      console.log("[VPN Debug] Auto-saving responses:", Object.keys(responses));
      Object.entries(responses).forEach(([questionId, value]) => {
        console.log(`[VPN Debug] Saving ${questionId}:`, value);
        saveMutation.mutate({
          organizationSlug: slug,
          questionId,
          response:
            typeof value === "object" ? JSON.stringify(value) : String(value),
          userEmail: user?.email || "",
        });
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [responses, slug]);

  // ── Business logic ───────────────────────────────────────────────────────────

  // Toggle N/A for a question
  const toggleQuestionNa = (questionId: string) => {
    setNaQuestions((prev) => {
      const next = new Set(prev);
      const isNow = next.has(questionId);
      if (isNow) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      // Save to backend
      if (slug && user?.email) {
        saveMutation.mutate({
          organizationSlug: slug,
          questionId: `__question_na:${questionId}`,
          response: isNow ? "false" : "true",
          userEmail: user.email,
        });
      }
      return next;
    });
  };

  // Calculate section progress (including uploaded files)
  const calculateSectionProgress = (section: Section): number => {
    // Handle integration-workflows section
    if (section.type === "integration-workflows") {
      const wfKeys = ["orders", "images", "priors", "reports"] as const;
      const completedWorkflows = wfKeys.filter((wf) => {
        const v = responses[`IW.${wf}_description`];
        return v && String(v).trim().length > 0;
      }).length;
      return Math.round((completedWorkflows / 4) * 100);
    }

    // Handle connectivity-table section
    if (section.type === "connectivity-table") {
      let total = 0;
      let answered = 0;
      // Standard questions (D.1, etc.)
      const stdQuestions = (section.questions || []).filter(
        (q) =>
          q.type !== "upload" && q.type !== "upload-download" && !q.inactive
      );
      total += stdQuestions.length;
      answered += stdQuestions.filter((q) => {
        if (naQuestions.has(q.id)) return true;
        const r = responses[q.id];
        return r !== undefined && r !== "" && r !== null;
      }).length;
      // Endpoints table — use connRows state (live Notion data)
      total += 1;
      if (
        connRows.length > 0 &&
        connRows.some(
          (r: any) =>
            r.sourceSystem || r.destinationSystem || r.sourceIp || r.destIp
        )
      ) {
        answered += 1;
      }
      // File uploads
      const uploadQuestions = (section.questions || []).filter(
        (q) => q.type === "upload" || q.type === "upload-download"
      );
      total += uploadQuestions.length;
      answered += uploadQuestions.filter(
        (q) =>
          naQuestions.has(q.id) ||
          allUploadedFiles.some((f) => f.questionId === q.id)
      ).length;
      return total > 0 ? Math.round((answered / total) * 100) : 100;
    }

    // Handle workflow sections
    if (section.type === "workflow") {
      const configKey = section.id + "_config";
      const savedConfig = responses[configKey];

      if (!savedConfig) return 0;

      try {
        const config =
          typeof savedConfig === "string"
            ? JSON.parse(savedConfig)
            : savedConfig;

        // Get all selected path keys
        const selectedPathKeys = Object.keys(config.paths || {}).filter(
          (key) => config.paths[key]
        );

        if (selectedPathKeys.length === 0) return 0;

        // Orders and Images workflows have fixed systems (no input fields)
        // Only Priors and Reports workflows require system name inputs
        const workflowsRequiringSystemNames = [
          "priors-workflow",
          "reports-out-workflow",
        ];

        if (!workflowsRequiringSystemNames.includes(section.id)) {
          // For Orders/Images: complete if at least one path is selected
          return 100;
        }

        // For Priors/Reports: check if all selected paths have their system names filled in
        const pathToSystemKeyMap: Record<string, string> = {
          priorsPush: "priorsPushSource",
          priorsQuery: "priorsQuerySource",
          reportsToPortal: "reportsPortalDestination",
        };

        const allSystemsFilled = selectedPathKeys.every((pathKey) => {
          const systemKey = pathToSystemKeyMap[pathKey];
          if (!systemKey) return true;
          const systemValue = config.systems?.[systemKey];
          return systemValue && systemValue.trim() !== "";
        });

        return allSystemsFilled
          ? 100
          : Math.round(
              (selectedPathKeys.length / (selectedPathKeys.length + 1)) * 100
            );
      } catch {
        return 0;
      }
    }

    // Standard sections with questions
    if (!section.questions) return 0;

    // Filter out inactive and hidden conditional questions first
    const visibleQuestions = section.questions.filter((q) => {
      if (q.inactive) return false;
      if (q.conditionalOn) {
        const parentResponse = responses[q.conditionalOn.questionId];
        return parentResponse === q.conditionalOn.value;
      }
      return true;
    });

    const answered = visibleQuestions.filter((q) => {
      // N/A questions count as answered
      if (naQuestions.has(q.id)) return true;

      const response = responses[q.id];

      // systems-list: complete if at least one system has been added
      if (q.type === "systems-list") {
        try {
          const data = response
            ? typeof response === "string"
              ? JSON.parse(response)
              : response
            : [];
          return Array.isArray(data) && data.length > 0;
        } catch {
          return false;
        }
      }

      // contacts-table: complete if any contact field is non-empty
      if (q.type === "contacts-table") {
        try {
          const data = response
            ? typeof response === "string"
              ? JSON.parse(response)
              : response
            : {};
          return Object.values(data).some((row: any) =>
            Object.values(row || {}).some(
              (v: any) => v && String(v).trim() !== ""
            )
          );
        } catch {
          return false;
        }
      }

      const hasResponse = Array.isArray(response)
        ? response.length > 0
        : response !== undefined && response !== "" && response !== null;
      const hasUploadedFile = allUploadedFiles.some(
        (f) => f.questionId === q.id
      );
      return hasResponse || hasUploadedFile;
    }).length;

    return visibleQuestions.length > 0
      ? Math.round((answered / visibleQuestions.length) * 100)
      : 100;
  };

  // Handle file upload
  const handleFileUpload = async (questionId: string, file: File) => {
    if (!slug) return;

    setUploadingFiles((prev) => new Set(prev).add(questionId));

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      await uploadMutation.mutateAsync({
        organizationSlug: slug,
        questionId,
        fileName: file.name,
        fileData: base64,
        mimeType: file.type,
        userEmail: user?.email || "",
      });
    };
    reader.readAsDataURL(file);
  };

  // Export every response currently in state as JSON.
  //
  // We iterate `responses` directly (not `questionnaireSections`) so that keys
  // rendered only by component code — the IW.historic_results_*, IW.tech_sheets_*,
  // IW.overlay_pacs_*, IW.ct_dose_*, IW.<wf>_systems, CONN.endpoints, and
  // __question_na:* flags — round-trip correctly alongside declared questions.
  const handleExportData = () => {
    const declared = new Map<string, { section: string; q: Question }>();
    questionnaireSections.forEach((section) => {
      section.questions?.forEach((q) => {
        declared.set(q.id, { section: section.title, q });
      });
    });

    const exportResponses: Record<string, any> = {};
    const meta: Record<
      string,
      { section?: string; text?: string; type?: string; options?: string[] }
    > = {};

    Object.entries(responses).forEach(([qid, raw]) => {
      if (raw === undefined || raw === null || raw === "") return;

      const info = declared.get(qid);
      // Declared file-upload questions point at S3 objects that live outside
      // the responses table — nothing meaningful to round-trip.
      if (info && (info.q.type === "upload" || info.q.type === "upload-download")) {
        return;
      }

      exportResponses[qid] =
        typeof raw === "string"
          ? (() => {
              try {
                return JSON.parse(raw);
              } catch {
                return raw;
              }
            })()
          : raw;

      if (info) {
        meta[qid] = {
          section: info.section,
          text: info.q.text,
          type: info.q.type,
          ...(info.q.options ? { options: info.q.options } : {}),
        };
      }
    });

    const payload = {
      exported: new Date().toISOString(),
      org: slug,
      responses: exportResponses,
      meta,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-intake-responses.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import responses — JSON only. Preserves complex shapes (arrays, nested
  // objects for contacts-table / systems-list / IW.*_systems) by round-tripping
  // through JSON.stringify on save.
  const handleImportFile = async (
    importFile: File,
    onSuccess: () => void,
    setIsImporting: (v: boolean) => void
  ) => {
    if (!importFile || !slug) return;

    setIsImporting(true);
    try {
      const text = await importFile.text();
      const trimmed = text.trimStart();

      const looksLikeJson =
        importFile.name.toLowerCase().endsWith(".json") ||
        trimmed.startsWith("{") ||
        trimmed.startsWith("[");
      if (!looksLikeJson) {
        throw new Error(
          "Unsupported file format. Please upload a .json file exported from this tool."
        );
      }

      let payload: unknown;
      try {
        payload = JSON.parse(trimmed);
      } catch (err) {
        throw new Error(
          `Failed to parse JSON: ${err instanceof Error ? err.message : "Invalid JSON"}`
        );
      }

      const src =
        payload && typeof payload === "object" && "responses" in (payload as any)
          ? (payload as any).responses
          : payload;
      if (typeof src !== "object" || src === null || Array.isArray(src)) {
        throw new Error(
          "Invalid JSON structure — expected a { responses: { ... } } object or a flat responses object."
        );
      }

      const importedResponses: Record<string, any> = {};
      Object.entries(src as Record<string, unknown>).forEach(([qid, val]) => {
        if (val === undefined || val === null || val === "") return;
        importedResponses[qid] = val;
      });

      const importCount = Object.keys(importedResponses).length;
      if (importCount === 0) {
        throw new Error(
          "No responses found in file. Make sure the file contains questionnaire data."
        );
      }

      setResponses((prev) => ({ ...prev, ...importedResponses }));
      await Promise.all(
        Object.entries(importedResponses).map(([questionId, value]) =>
          saveMutation.mutateAsync({
            organizationSlug: slug,
            questionId,
            response:
              typeof value === "object"
                ? JSON.stringify(value)
                : String(value),
            userEmail: user?.email || "",
          })
        )
      );

      toast.success("Import successful", {
        description: `Imported ${importCount} responses`,
      });
      onSuccess();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed", {
        description:
          error instanceof Error
            ? error.message
            : "Failed to parse import file",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Notion connectivity sync
  const handleConnChange = async (newRows: ConnectivityRow[]) => {
    const oldIds = new Set(connRows.map((r) => r.id));
    const newIds = new Set(newRows.map((r) => r.id));
    setConnRows(newRows); // optimistic

    // Always keep local DB in sync as backup
    if (slug && user?.email) {
      saveMutation.mutate({
        organizationSlug: slug,
        questionId: "CONN.endpoints",
        response: JSON.stringify(newRows),
        userEmail: user.email,
      });
    }

    // Write-through to Notion if configured
    if (!notionConnData?.configured || !org?.name) return;

    for (const row of connRows) {
      if (
        !newIds.has(row.id) &&
        notionPageIds.current.has(row.id)
      ) {
        archiveConnRow.mutate({ pageId: row.id });
        notionPageIds.current.delete(row.id);
      }
    }
    for (const row of newRows) {
      if (!oldIds.has(row.id)) {
        createConnRow.mutate(
          { organizationName: org.name, row },
          {
            onSuccess: ({ pageId }) => {
              notionPageIds.current.add(pageId);
              setConnRows((prev) =>
                prev.map((r) => (r.id === row.id ? { ...r, id: pageId } : r))
              );
            },
          }
        );
      } else if (notionPageIds.current.has(row.id)) {
        const old = connRows.find((r) => r.id === row.id);
        if (JSON.stringify(old) !== JSON.stringify(row)) {
          updateConnRow.mutate({
            pageId: row.id,
            organizationName: org.name,
            row,
          });
        }
      }
    }
  };

  return {
    // Data
    org,
    orgLoading,
    existingResponses,
    responses,
    setResponses,
    saveStatus,
    setSaveStatus,
    fileCount,
    allUploadedFiles,
    connRows,
    dbTemplateMap,
    uploadedFilesMap,
    naQuestions,
    uploadingFiles,
    // Mutations
    saveMutation,
    submitFeedbackMutation,
    deleteMutation,
    // Handlers
    handleFileUpload,
    handleExportData,
    handleImportFile,
    handleConnChange,
    toggleQuestionNa,
    calculateSectionProgress,
    // Auth
    user,
  };
}
