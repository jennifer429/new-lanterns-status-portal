import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { questionnaireSections, type Section } from "@shared/questionnaireData";
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
  const isImportingRef = useRef(false);

  // ── tRPC queries ─────────────────────────────────────────────────────────────

  const { data: org } = trpc.organizations.getBySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );

  const { data: existingResponses, isLoading: orgLoading } =
    trpc.intake.getResponses.useQuery(
      { organizationSlug: slug || "" },
      { enabled: !!slug, refetchOnWindowFocus: false }
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

  // Workflow pathway summaries — canonical source for integration-workflows progress
  const { data: workflowPathwayRows = [] } = trpc.workflowPathways.list.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  // Fetch contacts and systems from normalized tables (source of truth from Notion)
  const { data: contactsData } = trpc.contacts.getForOrg.useQuery(
    { organizationSlug: slug || "" },
    { enabled: !!slug }
  );

  const { data: systemsData } = trpc.systems.getForOrg.useQuery(
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
    onSuccess: (data, variables) => {
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
      
      const orgName = org?.name || slug;
      toast.success(`File uploaded to ${orgName}`, {
        description: data.message || `Your file has been successfully uploaded.`
      });
    },
    onError: (error, variables) => {
      setUploadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(variables.questionId);
        return next;
      });
      console.error("File upload failed:", error);
      toast.error("Upload failed", { description: error.message });
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

  const upsertWorkflowPathway = trpc.workflowPathways.upsert.useMutation({
    onSuccess: () => utils.workflowPathways.list.invalidate({ organizationSlug: slug || "" }),
  });

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
  useEffect(() => {
    if (notionConnData?.rows && notionConnData.rows.length > 0) {
      setConnRows(notionConnData.rows as ConnectivityRow[]);
      notionPageIds.current = new Set(
        notionConnData.rows.map((r: any) => r.id)
      );
    } else if (notionConnData !== undefined) {
      // Notion configured but empty — fall back to local DB data
      try {
        const v = responses["CONN.endpoints"];
        if (v) setConnRows(typeof v === "string" ? JSON.parse(v) : v);
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notionConnData]);

  // Load existing responses into state — only on initial data load.
  // We use a ref to track whether we've already hydrated from the server
  // to prevent refetches from overwriting user edits in progress.
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    // Skip state reset during import — import manages its own state
    if (isImportingRef.current) return;
    // Only hydrate from server data once (on initial load)
    // After that, local state is the source of truth until page reload
    if (hasHydratedRef.current) return;
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
      hasHydratedRef.current = true;

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
    // Skip auto-save during import — import handles its own persistence
    if (isImportingRef.current) return;

    const timer = setTimeout(() => {
      setSaveStatus("saving");
      Object.entries(responses).forEach(([questionId, value]) => {
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
        const row = workflowPathwayRows.find(
          (r) => r.workflowType === wf && r.pathId === "__summary",
        );
        if (row?.notes && row.notes.trim().length > 0) return true;
        // Fallback for pre-migration data still living in intakeResponses
        const legacy = responses[`IW.${wf}_description`];
        return !!(legacy && String(legacy).trim().length > 0);
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

      // systems-list: complete if at least one system exists in normalized table
      if (q.type === "systems-list") {
        return systemsData?.rows && systemsData.rows.length > 0;
      }

      // contacts-table: complete if at least one contact exists in normalized table
      if (q.type === "contacts-table") {
        return contactsData?.rows && contactsData.rows.length > 0;
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

  // Export questionnaire responses as JSON
  const handleExportData = () => {
    const exportResponses: Record<string, any> = {};
    const meta: Record<
      string,
      { section: string; text: string; type: string; options?: string[] }
    > = {};

    questionnaireSections.forEach((section) => {
      if (section.type === "workflow" || !section.questions) return;
      section.questions.forEach((q) => {
        if (q.type === "upload" || q.type === "upload-download") return;
        const raw = responses[q.id];
        if (raw !== undefined && raw !== null && raw !== "") {
          exportResponses[q.id] =
            typeof raw === "string"
              ? (() => {
                  try {
                    return JSON.parse(raw);
                  } catch {
                    return raw;
                  }
                })()
              : raw;
        }
        meta[q.id] = {
          section: section.title,
          text: q.text,
          type: q.type,
          ...(q.options ? { options: q.options } : {}),
        };
      });
    });

    // Workflow pathway summaries now live in workflowPathways, not responses.
    // Project them back into IW.<wf>_description / IW.<wf>_systems so the
    // export stays round-trippable with the import path.
    for (const row of workflowPathwayRows) {
      if (row.pathId !== "__summary") continue;
      const wf = row.workflowType;
      if (row.notes && row.notes.trim().length > 0) {
        exportResponses[`IW.${wf}_description`] = row.notes;
      }
      if (row.systems) {
        try {
          const parsed = JSON.parse(row.systems);
          if (Array.isArray(parsed) && parsed.length > 0) {
            exportResponses[`IW.${wf}_systems`] = parsed;
          }
        } catch { /* ignore malformed */ }
      }
    }

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
  };

  // Import responses — supports JSON (new) and legacy pipe-delimited (txt/csv) formats
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
      const importedResponses: Record<string, any> = {};

      const looksLikeJson =
        importFile.name.endsWith(".json") ||
        trimmed.startsWith("{") ||
        trimmed.startsWith("[");

      if (looksLikeJson) {
        try {
          const payload = JSON.parse(trimmed);
          const src = payload.responses ?? payload;
          if (typeof src !== "object" || src === null)
            throw new Error("Invalid JSON structure");
          Object.entries(src).forEach(([qid, val]) => {
            if (val !== undefined && val !== null && val !== "") {
              importedResponses[qid] = val;
            }
          });
        } catch (jsonErr) {
          throw new Error(
            `Failed to parse JSON: ${jsonErr instanceof Error ? jsonErr.message : "Invalid JSON"}`
          );
        }
      } else {
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length === 0) throw new Error("File is empty");

        const header = lines[0] || "";
        const isPipeDelimited = header.includes("|");

        if (!isPipeDelimited) {
          throw new Error(
            "Unrecognized file format. Expected a .json export file or a pipe-delimited (|) .txt/.csv file. " +
              "Tip: Use the Export button to download a .json file, then re-import that file."
          );
        }

        const hasOptionsColumn = header.split("|").length >= 6;
        lines.slice(1).forEach((line) => {
          const parts = line.split("|");
          const questionId = hasOptionsColumn
            ? parts[1]?.trim()
            : parts[1]?.trim();
          const responseType = hasOptionsColumn
            ? parts[3]?.trim()
            : parts[3]?.trim();
          const responseValue = hasOptionsColumn
            ? parts[5]?.trim()
            : parts[4]?.trim();
          if (!questionId || !responseValue) return;
          if (responseType === "workflow") return;
          if (
            responseType === "contacts-table" ||
            responseType === "systems-list"
          ) {
            try {
              importedResponses[questionId] = JSON.parse(responseValue);
            } catch {
              importedResponses[questionId] = responseValue;
            }
          } else if (
            responseType === "multi-select" ||
            responseType === "multiple-choice"
          ) {
            importedResponses[questionId] = responseValue
              .split("; ")
              .map((v: string) => v.trim())
              .filter(Boolean);
          } else {
            importedResponses[questionId] = responseValue;
          }
        });
      }

      const importCount = Object.keys(importedResponses).length;
      if (importCount === 0)
        throw new Error(
          "No responses found in file. Make sure the file contains questionnaire data."
        );

      // Block auto-save during import — import handles its own persistence
      isImportingRef.current = true;
      setResponses((prev) => ({ ...prev, ...importedResponses }));

      // Route primary workflow summaries into workflowPathways (canonical).
      // Everything else (including secondary IW.* keys like historic_results,
      // tech_sheets, overlay_pacs, ct_dose) continues going to intakeResponses.
      const primaries = ["orders", "images", "priors", "reports"] as const;
      const summaryPatch: Record<string, { description?: string; systems?: string[] }> = {};
      const regularEntries: [string, unknown][] = [];
      for (const [qid, value] of Object.entries(importedResponses)) {
        const descMatch = primaries.find((wf) => qid === `IW.${wf}_description`);
        const sysMatch = primaries.find((wf) => qid === `IW.${wf}_systems`);
        if (descMatch) {
          (summaryPatch[descMatch] ||= {}).description = String(value ?? "");
        } else if (sysMatch) {
          let arr: string[] = [];
          if (Array.isArray(value)) arr = value.filter((s): s is string => typeof s === "string");
          else if (typeof value === "string") {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) arr = parsed.filter((s): s is string => typeof s === "string");
            } catch { /* ignore */ }
          }
          (summaryPatch[sysMatch] ||= {}).systems = arr;
        } else {
          regularEntries.push([qid, value]);
        }
      }

      await Promise.all([
        ...regularEntries.map(([questionId, value]) =>
          saveMutation.mutateAsync({
            organizationSlug: slug,
            questionId,
            response:
              typeof value === "object" ? JSON.stringify(value) : String(value),
            userEmail: user?.email || "",
          })
        ),
        ...Object.entries(summaryPatch).map(([wf, patch]) =>
          upsertWorkflowPathway.mutateAsync({
            organizationSlug: slug,
            workflowType: wf as (typeof primaries)[number],
            pathId: "__summary",
            enabled: true,
            ...(patch.description !== undefined ? { notes: patch.description } : {}),
            ...(patch.systems !== undefined ? { systems: patch.systems } : {}),
          })
        ),
      ]);

      // Import saves are complete. Local state is already correct.
      // No need to invalidate/refetch since hasHydratedRef prevents
      // server data from overwriting local state anyway.
      isImportingRef.current = false;

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
      isImportingRef.current = false;
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
        archiveConnRow.mutate({ pageId: row.id, organizationSlug: slug });
        notionPageIds.current.delete(row.id);
      }
    }
    for (const row of newRows) {
      if (!oldIds.has(row.id)) {
        createConnRow.mutate(
          { organizationSlug: slug, organizationName: org.name, row },
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
            organizationSlug: slug,
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
