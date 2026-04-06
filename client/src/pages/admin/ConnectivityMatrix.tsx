import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Download, Upload, Edit, Copy, Check, Clock, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** HL7 connectivity fields shown per-org in the card layout. */
const HL7_ORDERS_FIELDS = [
  { label: "Org IP",          questionId: "meta.hl7_ord_org_ip" },
  { label: "Org Port",        questionId: "meta.hl7_ord_org_port" },
  { label: "Silverback IP",   questionId: "meta.hl7_ord_sb_ip" },
  { label: "Silverback Port", questionId: "meta.hl7_ord_sb_port" },
  { label: "NL IP",           questionId: "meta.hl7_ord_nl_ip" },
  { label: "NL Port",         questionId: "meta.hl7_ord_nl_port" },
] as const;

const HL7_RESULTS_FIELDS = [
  { label: "NL IP",           questionId: "meta.hl7_res_nl_ip" },
  { label: "NL Port",         questionId: "meta.hl7_res_nl_port" },
  { label: "Silverback IP",   questionId: "meta.hl7_res_sb_ip" },
  { label: "Silverback Port", questionId: "meta.hl7_res_sb_port" },
  { label: "Org IP",          questionId: "meta.hl7_res_org_ip" },
  { label: "Org Port",        questionId: "meta.hl7_res_org_port" },
] as const;

/** A 3-node flow block: [left label + IP/port] → [mid label + IP/port] → [right label + IP/port] */
function HL7FlowRow({
  direction,
  leftLabel, leftIp, leftPort,
  midLabel,  midIp,  midPort,
  rightLabel, rightIp, rightPort,
}: {
  direction: "→" | "←";
  leftLabel: string;  leftIp: string;  leftPort: string;
  midLabel: string;   midIp: string;   midPort: string;
  rightLabel: string; rightIp: string; rightPort: string;
}) {
  const Node = ({ label, ip, port }: { label: string; ip: string; port: string }) => (
    <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="w-full border border-border rounded-md bg-muted/20 px-2 py-1.5 text-center">
        {ip || port ? (
          <>
            {ip && <div className="font-mono text-xs text-foreground leading-tight truncate">{ip}</div>}
            {port && <div className="font-mono text-xs text-primary leading-tight">:{port}</div>}
          </>
        ) : (
          <div className="font-mono text-xs text-muted-foreground/50">—</div>
        )}
      </div>
    </div>
  );

  const Arrow = () => (
    <div className="flex items-center justify-center text-muted-foreground/50 text-lg font-light shrink-0 px-1 mt-5">
      {direction}
    </div>
  );

  return (
    <div className="flex items-start gap-1">
      <Node label={leftLabel}  ip={leftIp}   port={leftPort} />
      <Arrow />
      <Node label={midLabel}   ip={midIp}    port={midPort} />
      <Arrow />
      <Node label={rightLabel} ip={rightIp}  port={rightPort} />
    </div>
  );
}

/** Card for a single organization showing its HL7 Orders + Results flows. */
function HL7OrgCard({
  org,
  responses,
}: {
  org: { id: number; name: string; slug: string };
  responses: Record<string, string>;
}) {
  const get = (qid: string) => responses[qid] ?? "";

  const ordersComplete =
    get("meta.hl7_ord_org_ip") || get("meta.hl7_ord_org_port") ||
    get("meta.hl7_ord_sb_ip")  || get("meta.hl7_ord_nl_ip");

  const resultsComplete =
    get("meta.hl7_res_nl_ip") || get("meta.hl7_res_nl_port") ||
    get("meta.hl7_res_sb_ip") || get("meta.hl7_res_org_ip");

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{org.name}</CardTitle>
          <div className="flex gap-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ordersComplete ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}>
              Orders {ordersComplete ? "✓" : "—"}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${resultsComplete ? "bg-blue-500/15 text-blue-400" : "bg-muted text-muted-foreground"}`}>
              Results {resultsComplete ? "✓" : "—"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* HL7 Orders: Site → Silverback → New Lantern */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            HL7 Orders
          </div>
          <HL7FlowRow
            direction="→"
            leftLabel="Client Site"
            leftIp={get("meta.hl7_ord_org_ip")}
            leftPort={get("meta.hl7_ord_org_port")}
            midLabel="Silverback"
            midIp={get("meta.hl7_ord_sb_ip")}
            midPort={get("meta.hl7_ord_sb_port")}
            rightLabel="New Lantern"
            rightIp={get("meta.hl7_ord_nl_ip")}
            rightPort={get("meta.hl7_ord_nl_port")}
          />
        </div>

        <div className="border-t border-border/40" />

        {/* HL7 Results: New Lantern → Silverback → Site */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            HL7 Results
          </div>
          <HL7FlowRow
            direction="→"
            leftLabel="New Lantern"
            leftIp={get("meta.hl7_res_nl_ip")}
            leftPort={get("meta.hl7_res_nl_port")}
            midLabel="Silverback"
            midIp={get("meta.hl7_res_sb_ip")}
            midPort={get("meta.hl7_res_sb_port")}
            rightLabel="Client Site"
            rightIp={get("meta.hl7_res_org_ip")}
            rightPort={get("meta.hl7_res_org_port")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** HL7 Layout view — card per org showing Orders + Results flows. */
function HL7Layout({ orgs }: { orgs: { id: number; name: string; slug: string }[] }) {
  const { data: allResponses = [], isLoading } = trpc.admin.getAllOrgResponses.useQuery();

  // Build per-org response lookup
  const lookup = allResponses.reduce<Record<number, Record<string, string>>>((acc, r) => {
    if (!acc[r.organizationId]) acc[r.organizationId] = {};
    acc[r.organizationId][r.questionId] = r.response ?? "";
    return acc;
  }, {});

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">HL7 Connectivity</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Per-organization HL7 Orders and Results endpoint overview. Edit values in the Connectivity Matrix tab.
        </p>
      </div>

      {orgs.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No organizations accessible.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orgs.map(org => (
            <HL7OrgCard
              key={org.id}
              org={org}
              responses={lookup[org.id] ?? {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Connectivity Matrix ──────────────────────────────────────────────────────

/** Rows the matrix always shows, keyed by questionId stored in intakeResponses.
 *  `meta.*` IDs are admin-only fields that don't exist in the client questionnaire
 *  but are stored the same way so they're fully editable and persistent.
 *  `fromQuestionnaire: true` rows pull directly from client intake answers. */
const MATRIX_SECTIONS: { title: string; rows: { label: string; questionId: string; isEmail?: boolean; isPhone?: boolean; fromQuestionnaire?: boolean }[] }[] = [
  {
    title: "Organization",
    rows: [
      { label: "Go-Live Date",   questionId: "D.2",  fromQuestionnaire: true },
      { label: "# Sites",        questionId: "H.1",  fromQuestionnaire: true },
      { label: "Site Names",     questionId: "H.2",  fromQuestionnaire: true },
      { label: "Modalities",     questionId: "D.3",  fromQuestionnaire: true },
      { label: "Studies / Day",  questionId: "D.4",  fromQuestionnaire: true },
    ],
  },
  {
    title: "Contacts",
    rows: [
      { label: "Admin Contact",       questionId: "A.1",  fromQuestionnaire: true },
      { label: "IT Contact",          questionId: "A.2",  fromQuestionnaire: true },
      { label: "Prod Support Contact", questionId: "meta.prod_support_contact" },
    ],
  },
  {
    title: "Systems",
    rows: [
      { label: "PACS",              questionId: "meta.pacs_system" },
      { label: "RIS",               questionId: "meta.ris_system" },
      { label: "EMR",               questionId: "meta.emr_system" },
      { label: "Interface Engine",  questionId: "meta.interface_engine" },
    ],
  },
  {
    title: "DICOM Routing",
    rows: [
      { label: "Test Endpoints",    questionId: "E.2",   fromQuestionnaire: true },
      { label: "Prod Endpoints",    questionId: "E.2.1", fromQuestionnaire: true },
    ],
  },
  {
    title: "HL7 Orders",
    rows: [
      { label: "Test Environment",  questionId: "E.3",   fromQuestionnaire: true },
      { label: "Prod Environment",  questionId: "E.3.1", fromQuestionnaire: true },
    ],
  },
  {
    title: "HL7 Results",
    rows: [
      { label: "Test Environment",  questionId: "E.5",   fromQuestionnaire: true },
      { label: "Prod Environment",  questionId: "E.5.1", fromQuestionnaire: true },
    ],
  },
  {
    title: "Endpoints",
    rows: [
      { label: "Org IP",            questionId: "meta.ep_org_ip" },
      { label: "Org DICOM Port",    questionId: "meta.ep_org_dicom_port" },
      { label: "Org HL7 Port",      questionId: "meta.ep_org_hl7_port" },
      { label: "NL IP",             questionId: "meta.ep_nl_ip" },
      { label: "NL DICOM Port",     questionId: "meta.ep_nl_dicom_port" },
      { label: "NL HL7 Port",       questionId: "meta.ep_nl_hl7_port" },
      { label: "Silverback IP",     questionId: "meta.ep_sb_ip" },
    ],
  },
  {
    title: "Known Gotchas / Exceptions",
    rows: [
      { label: "Accession Format",  questionId: "meta.accession_format" },
      { label: "Priors Available",  questionId: "meta.priors_available" },
      { label: "Downtime Plans",    questionId: "L.11", fromQuestionnaire: true },
      { label: "ORC-1 Values",      questionId: "G.3",  fromQuestionnaire: true },
      { label: "ORC-5 Values",      questionId: "G.4",  fromQuestionnaire: true },
      { label: "Other Notes",       questionId: "meta.other_notes" },
    ],
  },
];


/** Status dot for the prod_status field */
function StatusDot({ value }: { value: string }) {
  const lower = (value ?? "").toLowerCase();
  if (lower === "active")     return <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Active</span>;
  if (lower === "monitoring") return <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Monitoring</span>;
  if (lower === "pending")    return <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50 inline-block" />Pending</span>;
  if (lower === "inactive")   return <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Inactive</span>;
  return <span className="text-muted-foreground">{value || "—"}</span>;
}

type AuditMeta = { updatedBy?: string | null; updatedAt?: Date | string | null; createdAt?: Date | string | null };

function fmtDate(d?: Date | string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** If a stored value is a JSON array, render it as a comma-separated list; otherwise return as-is. */
function formatCellDisplay(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((v: unknown) => String(v)).join(", ");
      }
    } catch {
      // fall through
    }
  }
  return raw;
}

/** Single editable cell — click to edit, hover shows copy + audit tooltip */
function MatrixCell({
  orgId, questionId, initialValue, audit, isEmail, isPhone, isStatus, isGotcha,
  onSaved,
}: {
  orgId: number; questionId: string; initialValue: string; audit?: AuditMeta;
  isEmail?: boolean; isPhone?: boolean; isStatus?: boolean; isGotcha?: boolean;
  onSaved?: (questionId: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(initialValue);
  const [saved, setSaved]     = useState(initialValue);
  const [copied, setCopied]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveMutation = trpc.admin.saveOrgResponse.useMutation({
    onSuccess: () => { setSaved(draft); onSaved?.(questionId, draft); },
    onError:   () => { setDraft(saved); toast.error("Failed to save — change reverted"); },
  });

  const commit = () => {
    setEditing(false);
    if (draft !== saved) saveMutation.mutate({ organizationId: orgId, questionId, response: draft });
  };

  const copyValue = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = saved || "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  // Keep in sync when parent data refreshes (e.g. after import)
  useEffect(() => { setDraft(initialValue); setSaved(initialValue); }, [initialValue]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter")  commit();
          if (e.key === "Escape") { setDraft(saved); setEditing(false); }
        }}
        className="w-full bg-muted/30 border border-primary/40 rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  const hasAudit = audit && (audit.updatedBy || audit.updatedAt);

  return (
    <span className="group inline-flex items-center gap-1 min-w-[4rem]">
      {/* Clickable value area */}
      <span
        onClick={() => setEditing(true)}
        className={`cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-muted/40 transition-colors inline-flex items-center gap-1 ${
          isGotcha ? "text-amber-500 dark:text-amber-400" : ""
        }`}
      >
        {isStatus ? (
          <StatusDot value={saved} />
        ) : isEmail && saved ? (
          <a href={`mailto:${saved}`} onClick={e => e.stopPropagation()} className="text-primary hover:underline inline-flex items-center gap-1">
            {saved}<ExternalLink className="w-3 h-3" />
          </a>
        ) : isPhone && saved ? (
          <a href={`tel:${saved}`} onClick={e => e.stopPropagation()} className="hover:underline">{saved}</a>
        ) : (
          <span className="font-mono text-sm">{formatCellDisplay(saved) || "—"}</span>
        )}
        <Edit className="w-2.5 h-2.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 shrink-0" />
      </span>

      {/* Copy button — visible on hover */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={copyValue}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted/60 shrink-0"
            tabIndex={-1}
          >
            {copied
              ? <Check className="w-3 h-3 text-green-500" />
              : <Copy className="w-3 h-3 text-muted-foreground/60" />
            }
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied!" : "Copy value"}</TooltipContent>
      </Tooltip>

      {/* Audit badge — only shown when audit data exists */}
      {hasAudit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-default">
              <Clock className="w-3 h-3 text-muted-foreground/40" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[220px] text-left space-y-0.5 leading-snug">
            {audit?.updatedBy && <div><span className="text-muted-foreground">By:</span> {audit.updatedBy}</div>}
            {audit?.updatedAt && <div><span className="text-muted-foreground">Updated:</span> {fmtDate(audit.updatedAt)}</div>}
            {audit?.createdAt && <div><span className="text-muted-foreground">Created:</span> {fmtDate(audit.createdAt)}</div>}
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

// ── CSV helpers ────────────────────────────────────────────────────────────────
function buildCSV(orgs: { id: number; name: string }[], lookup: Record<number, Record<string, string>>) {
  const header = ["Section", "Detail (questionId)", ...orgs.map(o => o.name)];
  const dataRows: string[][] = [];
  MATRIX_SECTIONS.forEach(section => {
    section.rows.forEach(row => {
      dataRows.push([section.title, `${row.label} (${row.questionId})`, ...orgs.map(o => lookup[o.id]?.[row.questionId] ?? "")]);
    });
  });
  return [header, ...dataRows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function downloadCSV(csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `connectivity-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse an imported CSV back into {orgId, questionId, response}[] rows.
 *  Expects the same format as the export: col 0 = Section, col 1 = "Label (questionId)", col 2+ = org values.
 *  Returns parsed rows + any validation errors. */
function parseImportCSV(csvText: string, orgs: { id: number; name: string }[]) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: [], errors: ["CSV has no data rows"] };

  const parseRow = (line: string) => {
    const cols: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQ) { inQ = true; continue; }
      if (ch === '"' && inQ && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"' && inQ) { inQ = false; continue; }
      if (ch === ',' && !inQ) { cols.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur);
    return cols;
  };

  const headers = parseRow(lines[0]);
  // Map header org names to org IDs
  const orgCols: { colIdx: number; orgId: number }[] = [];
  const errors: string[] = [];

  for (let i = 2; i < headers.length; i++) {
    const name = headers[i].trim();
    const org = orgs.find(o => o.name.trim().toLowerCase() === name.toLowerCase());
    if (org) orgCols.push({ colIdx: i, orgId: org.id });
    else errors.push(`Column "${name}" does not match any accessible organization — skipped`);
  }

  // Build a flat questionId lookup from MATRIX_SECTIONS for validation
  const qidByLabel: Record<string, string> = {};
  MATRIX_SECTIONS.forEach(s => s.rows.forEach(r => {
    qidByLabel[`${r.label} (${r.questionId})`.toLowerCase()] = r.questionId;
    qidByLabel[r.questionId.toLowerCase()] = r.questionId; // also accept bare qid
  }));

  const rows: { organizationId: number; questionId: string; response: string }[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cols = parseRow(lines[li]);
    const rawDetail = (cols[1] ?? "").trim().toLowerCase();
    const questionId = qidByLabel[rawDetail];
    if (!questionId) {
      if (rawDetail) errors.push(`Row ${li + 1}: unrecognized detail "${cols[1]}" — skipped`);
      continue;
    }
    for (const { colIdx, orgId } of orgCols) {
      const response = (cols[colIdx] ?? "").trim();
      if (response) rows.push({ organizationId: orgId, questionId, response });
    }
  }

  return { rows, errors };
}

// ── ConnectivityMatrix ─────────────────────────────────────────────────────────
export type ConnectivityOrg = { id: number; name: string; slug: string; partnerName?: string };
export function ConnectivityMatrix({ orgs }: { orgs: ConnectivityOrg[] }) {
  const utils = trpc.useUtils();
  const { data: allResponses = [], isLoading } = trpc.admin.getAllOrgResponses.useQuery();
  const { data: allFiles = [] } = trpc.admin.getAllFiles.useQuery();
  // Build map: orgId → first ARCH.diagram fileUrl
  const archDiagramByOrg = useMemo(() => {
    const map: Record<number, string> = {};
    for (const f of allFiles) {
      if (f.questionId === "ARCH.diagram" && f.organizationId && !map[f.organizationId]) {
        map[f.organizationId] = f.fileUrl;
      }
    }
    return map;
  }, [allFiles]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Partner + site filter
  const [connPartnerFilter, setConnPartnerFilter] = useState<string | null>(null);
  const [connSiteFilter, setConnSiteFilter] = useState<number | null>(null);

  const connAvailablePartners = useMemo(() => {
    const names = new Set(orgs.map(o => o.partnerName).filter(Boolean));
    return Array.from(names) as string[];
  }, [orgs]);

  const connAvailableSites = useMemo(() =>
    orgs.filter(o => connPartnerFilter === null || o.partnerName === connPartnerFilter),
    [orgs, connPartnerFilter]
  );

  const filteredOrgs = useMemo(() =>
    orgs.filter(o => {
      const matchesPartner = connPartnerFilter === null || o.partnerName === connPartnerFilter;
      const matchesSite = connSiteFilter === null || o.id === connSiteFilter;
      return matchesPartner && matchesSite;
    }),
    [orgs, connPartnerFilter, connSiteFilter]
  );

  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(
    () => new Set(MATRIX_SECTIONS.map((_, i) => i))
  );
  const toggleSection = (si: number) => setCollapsedSections(prev => {
    const next = new Set(prev);
    if (next.has(si)) { next.delete(si); } else { next.add(si); }
    return next;
  });

  // Import dialog state
  const [importOpen, setImportOpen]         = useState(false);
  const [importPreview, setImportPreview]   = useState<{ rows: { organizationId: number; questionId: string; response: string }[]; errors: string[] } | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const importFileRef = useRef<HTMLInputElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const scrollTable = (dir: 'left' | 'right') =>
    tableScrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });

  const bulkSave = trpc.admin.bulkSaveOrgResponses.useMutation({
    onSuccess: (result) => {
      toast.success(`Imported ${result.saved} cell${result.saved !== 1 ? "s" : ""}`);
      setImportOpen(false);
      setImportPreview(null);
      setImportFileName("");
      utils.admin.getAllOrgResponses.invalidate();
    },
    onError: (e) => toast.error(`Import failed: ${e.message}`),
  });

  // Build a lookup: orgId → questionId → { response, audit }
  type LookupEntry = { response: string; updatedBy?: string | null; updatedAt?: Date | string | null; createdAt?: Date | string | null };
  const lookup = allResponses.reduce<Record<number, Record<string, LookupEntry>>>((acc, r) => {
    if (!acc[r.organizationId]) acc[r.organizationId] = {};
    acc[r.organizationId][r.questionId] = {
      response: r.response ?? "",
      updatedBy: r.updatedBy,
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    };
    return acc;
  }, {});

  // For export, build a plain string lookup
  const strLookup = allResponses.reduce<Record<number, Record<string, string>>>((acc, r) => {
    if (!acc[r.organizationId]) acc[r.organizationId] = {};
    acc[r.organizationId][r.questionId] = r.response ?? "";
    return acc;
  }, {});

  const handleExport = () => downloadCSV(buildCSV(orgs, strLookup));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseImportCSV(text, orgs);
      setImportPreview(parsed);
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!importPreview || importPreview.rows.length === 0) return;
    bulkSave.mutate({ rows: importPreview.rows });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Connectivity Matrix</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Live data — click any cell to edit, hover to copy or view audit history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Import */}
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Connectivity Matrix</DialogTitle>
                <DialogDescription>
                  Upload a CSV exported from this matrix. Only non-empty cells will be written.
                  Column headers must match org names exactly.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div
                  onClick={() => importFileRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  {importFileName
                    ? <p className="text-sm font-medium">{importFileName}</p>
                    : <p className="text-sm text-muted-foreground">Click to select a .csv file</p>
                  }
                  <input ref={importFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
                </div>

                {importPreview && (
                  <div className="space-y-2 text-sm">
                    {importPreview.errors.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3 space-y-1">
                        {importPreview.errors.map((e, i) => (
                          <p key={i} className="text-amber-700 dark:text-amber-400 text-xs">{e}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-muted-foreground">
                      Ready to write <strong className="text-foreground">{importPreview.rows.length}</strong> cell{importPreview.rows.length !== 1 ? "s" : ""} across{" "}
                      <strong className="text-foreground">{Array.from(new Set(importPreview.rows.map(r => r.organizationId))).length}</strong> org{Array.from(new Set(importPreview.rows.map(r => r.organizationId))).length !== 1 ? "s" : ""}.
                    </p>
                    <Button
                      className="w-full"
                      disabled={importPreview.rows.length === 0 || bulkSave.isPending}
                      onClick={confirmImport}
                    >
                      {bulkSave.isPending ? "Importing…" : `Import ${importPreview.rows.length} cells`}
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Export */}
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Partner + site filter dropdowns */}
      {orgs.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {connAvailablePartners.length > 1 && (
            <Select
              value={connPartnerFilter === null ? "all" : connPartnerFilter}
              onValueChange={(v) => {
                setConnPartnerFilter(v === "all" ? null : v);
                setConnSiteFilter(null);
              }}
            >
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue placeholder="All Partners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Partners</SelectItem>
                {connAvailablePartners.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={connSiteFilter === null ? "all" : String(connSiteFilter)}
            onValueChange={(v) => setConnSiteFilter(v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="h-8 text-xs w-48">
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {connAvailableSites.map(org => (
                <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(connPartnerFilter !== null || connSiteFilter !== null) && (
            <button
              onClick={() => { setConnPartnerFilter(null); setConnSiteFilter(null); }}
              className="text-xs text-muted-foreground underline hover:no-underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}



      {orgs.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No organizations accessible.</p>
      ) : filteredOrgs.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No organizations selected. Use the filters above to show orgs.</p>
      ) : (
        <div className="relative">
          {/* Left scroll arrow */}
          <button
            onClick={() => scrollTable('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-30 -translate-x-4 w-7 h-7 rounded-full bg-card border border-border shadow flex items-center justify-center hover:bg-muted/70 transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          {/* Right scroll arrow */}
          <button
            onClick={() => scrollTable('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 translate-x-4 w-7 h-7 rounded-full bg-card border border-border shadow flex items-center justify-center hover:bg-muted/70 transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <div ref={tableScrollRef} className="overflow-auto rounded-lg border border-border mx-8" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-border bg-card">
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground w-44 min-w-[11rem] border-r border-border bg-card">Detail</th>
                {filteredOrgs.map(org => (
                  <th key={org.id} className="text-left py-3 px-4 min-w-[10rem] border-r border-border last:border-r-0 bg-card">
                    <span className="font-bold block leading-tight">{org.name}</span>
                    {org.partnerName && <span className="text-xs font-normal text-muted-foreground">{org.partnerName}</span>}
                    {archDiagramByOrg[org.id] && (
                      <button
                        onClick={() => setLightboxUrl(archDiagramByOrg[org.id])}
                        className="mt-1.5 block w-16 h-10 rounded overflow-hidden border border-border hover:border-primary transition-colors focus:outline-none"
                        title="View architecture diagram"
                      >
                        <img
                          src={archDiagramByOrg[org.id]}
                          alt="Architecture"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_SECTIONS.map((section, si) => {
                const isCollapsed = collapsedSections.has(si);
                return (
                  <>
                    <tr
                      key={`sh-${si}`}
                      className="bg-muted/30 hover:bg-muted/50 cursor-pointer select-none"
                      onClick={() => toggleSection(si)}
                    >
                      <td colSpan={filteredOrgs.length + 1} className="py-2 px-4 font-bold text-sm border-t border-border">
                        <div className="flex items-center gap-2">
                          <svg
                            className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0', isCollapsed ? '-rotate-90' : '')}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                          {section.title}
                          <span className="text-xs font-normal text-muted-foreground ml-1">({section.rows.length})</span>
                        </div>
                      </td>
                    </tr>
                    {!isCollapsed && section.rows.map((row, ri) => (
                      <tr key={`r-${si}-${ri}`} className="border-t border-border/40 hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-4 text-foreground/70 border-r border-border/40 w-44">
                          <div className="flex items-center gap-1.5">
                            {row.label}
                            {row.fromQuestionnaire && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <ClipboardList className="w-3 h-3 text-primary/50 shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>From client questionnaire ({row.questionId})</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        {filteredOrgs.map(org => {
                          const entry = lookup[org.id]?.[row.questionId];
                          return (
                            <td key={org.id} className="py-2 px-3 border-r border-border/40 last:border-r-0">
                              <MatrixCell
                                orgId={org.id}
                                questionId={row.questionId}
                                initialValue={entry?.response ?? ""}
                                audit={entry}
                                isEmail={row.isEmail}
                                isPhone={row.isPhone}
                                isStatus={row.questionId === "meta.prod_status"}
                                isGotcha={section.title === "Known Gotchas / Exceptions"}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Architecture diagram lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={open => { if (!open) setLightboxUrl(null); }}>
        <DialogContent className="max-w-5xl w-full p-2 bg-background">
          <DialogHeader className="sr-only">
            <DialogTitle>Architecture Diagram</DialogTitle>
          </DialogHeader>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Architecture diagram"
              className="w-full h-auto max-h-[85vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
