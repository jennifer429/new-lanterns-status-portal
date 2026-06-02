/**
 * StatusEmailDialog — admin "Send status update" composer.
 *
 * React port of the Claude Design "Implementation Update" mockup
 * (project/app/StatusEmail.jsx), wired to live data:
 *  - Recipients prepopulate from the site's users + the partner's admins; the
 *    admin can paste more, separated by comma or semicolon.
 *  - Blockers / tasks are added by BROWSING the site's real tasks & tests
 *    (catalog picker) and selecting them; owners come from real site people.
 *  - On send the email CCs the sender + is signed with their name, and the
 *    chosen owner + status is written back to the linked task / test
 *    (handled server-side in exports.sendStatusUpdate).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  Check,
  ChevronDown,
  ChevronLeft,
  ArrowRight,
  Mail,
  Send,
  AlertTriangle,
  ListChecks,
  Lock,
  FileText,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

type Kind = "task" | "test" | "question";
type CatalogItem = {
  id: string;
  kind: Kind;
  sourceId: string;
  group: string;
  text: string;
  owner: string;
  due: string;
  status: string;
  link: string;
};
type Item = {
  id: string;
  text: string;
  owner: string;
  due: string;
  kind?: Kind;
  sourceId?: string;
  group?: string;
  status?: string;
  link?: string;
};
type Recipient = { label: string; email: string };

interface StatusEmailDialogProps {
  org: { slug: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

function OwnerSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div className="se-select-wrap">
      <select className="se-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {!value && <option value="">Assign…</option>}
        {opts.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <ChevronDown className="se-select-ic" size={13} />
    </div>
  );
}

/** Browseable picker over the site's real tasks/tests. */
function CatalogPicker({
  catalog,
  existingIds,
  onPick,
  onCustom,
}: {
  catalog: CatalogItem[];
  existingIds: Set<string>;
  onPick: (item: CatalogItem) => void;
  onCustom: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const [tab, setTab] = useState<"all" | Kind>("all");
  const TABS: ReadonlyArray<readonly ["all" | Kind, string]> = [
    ["all", "All"],
    ["question", "Questionnaire"],
    ["task", "Tasks"],
    ["test", "Tests"],
  ];
  const KIND_LABEL: Record<Kind, string> = { question: "q", task: "task", test: "test" };

  const available = catalog.filter(
    (c) =>
      !existingIds.has(c.id) &&
      (tab === "all" || c.kind === tab) &&
      (q.trim() === "" ||
        `${c.text} ${c.group} ${c.owner}`.toLowerCase().includes(q.trim().toLowerCase()))
  );
  // Group by section/phase, preserving first-seen order, for quiet subheaders.
  const order: string[] = [];
  const byGroup = new Map<string, CatalogItem[]>();
  for (const c of available) {
    if (!byGroup.has(c.group)) {
      byGroup.set(c.group, []);
      order.push(c.group);
    }
    byGroup.get(c.group)!.push(c);
  }

  return (
    <div className="se-picker" ref={ref}>
      <div className="se-picker-actions">
        <button className="se-add" onClick={() => setOpen((v) => !v)}>
          <Search size={13} /> Add from site
        </button>
        <button className="se-add" onClick={onCustom}>
          <Plus size={13} /> Custom item
        </button>
      </div>
      {open && (
        <div className="se-picker-pop">
          <div className="se-picker-search">
            <Search size={13} className="se-muted" />
            <input
              autoFocus
              placeholder="Search tasks, tests & questions…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="se-picker-tabs">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                className={"se-ptab" + (tab === k ? " on" : "")}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="se-picker-list">
            {available.length === 0 && <div className="se-picker-empty">Nothing left to add</div>}
            {order.map((g) => (
              <div key={g}>
                <div className="se-pgroup">{g}</div>
                {byGroup.get(g)!.map((c) => (
                  <button
                    key={c.id}
                    className="se-picker-item"
                    onClick={() => {
                      onPick(c);
                      setOpen(false);
                      setQ("");
                    }}
                  >
                    <span className={"se-picker-kind " + c.kind}>{KIND_LABEL[c.kind]}</span>
                    <span className="se-picker-text">
                      <span className="se-picker-title">{c.text}</span>
                      <span className="se-picker-sub">
                        {c.status || ""}
                        {c.owner ? ` · ${c.owner}` : ""}
                      </span>
                    </span>
                    <Plus size={13} className="se-muted" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusEmailDialog({ org, open, onOpenChange }: StatusEmailDialogProps) {
  const { user } = useAuth();
  const draftQuery = trpc.exports.statusUpdateDraft.useQuery(
    { organizationSlug: org?.slug ?? "" },
    { enabled: open && !!org, refetchOnWindowFocus: false }
  );
  const sendMutation = trpc.exports.sendStatusUpdate.useMutation();

  const [step, setStep] = useState<"compose" | "confirm">("compose");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [draftEmail, setDraftEmail] = useState("");
  const [note, setNote] = useState("");
  const [blockers, setBlockers] = useState<Item[]>([]);
  const [tasks, setTasks] = useState<Item[]>([]);
  const [incProgress, setIncProgress] = useState(true);
  const [incBlockers, setIncBlockers] = useState(true);
  const [incTasks, setIncTasks] = useState(true);
  const [promptReply, setPromptReply] = useState(true);

  const draft = draftQuery.data;

  useEffect(() => {
    if (!draft) return;
    setStep("compose");
    setRecipients(draft.recipients.map((s) => ({ ...s })));
    setDraftEmail("");
    setNote(draft.note);
    setBlockers(draft.blockers.map((b) => ({ ...b, due: b.due || "" })));
    setTasks(draft.tasks.map((t) => ({ ...t, due: t.due || "" })));
    setIncProgress(true);
    setIncBlockers(true);
    setIncTasks(true);
    setPromptReply(true);
  }, [draft]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const recipientList = recipients.map((r) => r.email);
  const subject = draft?.subject ?? "";
  const assignees = draft?.assignees ?? [];
  const catalog = (draft?.catalog ?? []) as CatalogItem[];
  const senderName = user?.name?.trim() || user?.email?.split("@")[0] || "you";

  // Add one or more emails pasted/typed, split on comma or semicolon.
  const addEmails = (raw: string) => {
    const parts = raw.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
    let added = false;
    setRecipients((prev) => {
      const next = [...prev];
      for (const e of parts) {
        if (validEmail(e) && !next.some((r) => r.email === e)) {
          next.push({ label: e, email: e });
          added = true;
        }
      }
      return next;
    });
    if (added || parts.every((p) => validEmail(p))) setDraftEmail("");
  };
  const removeRecipient = (email: string) =>
    setRecipients((prev) => prev.filter((r) => r.email !== email));

  const updateItem =
    (setter: React.Dispatch<React.SetStateAction<Item[]>>) =>
    (i: number, field: "text" | "owner" | "due" | "__delete", val?: string) => {
      if (field === "__delete") return setter((prev) => prev.filter((_, x) => x !== i));
      setter((prev) => prev.map((it, x) => (x === i ? { ...it, [field]: val } : it)));
    };
  const updateBlocker = updateItem(setBlockers);
  const updateTask = updateItem(setTasks);

  const pickInto =
    (setter: React.Dispatch<React.SetStateAction<Item[]>>, defaultOwner: string) =>
    (c: CatalogItem) =>
      setter((prev) => [
        ...prev,
        {
          id: c.id,
          text: c.text,
          owner: c.owner || defaultOwner,
          due: c.due || "",
          kind: c.kind,
          sourceId: c.sourceId,
          group: c.group,
          status: c.status,
          link: c.link,
        },
      ]);
  const addCustom = (setter: React.Dispatch<React.SetStateAction<Item[]>>, owner: string) =>
    setter((prev) => [...prev, { id: "custom-" + Date.now(), text: "", owner, due: "" }]);

  const handleSend = () => {
    if (!org || !draft) return;
    const strip = (it: Item) => ({
      text: it.text,
      owner: it.owner,
      due: it.due || undefined,
      kind: it.kind,
      sourceId: it.sourceId,
      group: it.group,
      link: it.link,
    });
    sendMutation.mutate(
      {
        organizationSlug: org.slug,
        to: recipientList,
        toNames: recipients.map((r) => r.label.split(" · ")[0].trim()).filter(Boolean),
        subject,
        note,
        include: { progress: incProgress, blockers: incBlockers, tasks: incTasks, promptReply },
        progress: draft.progress,
        blockers: blockers.map(strip),
        tasks: tasks.map(strip),
        writeBack: true,
      },
      {
        onSuccess: (res) => {
          const wb = res.writtenBack ? ` · ${res.writtenBack} item${res.writtenBack !== 1 ? "s" : ""} updated on the site` : "";
          toast.success(
            `Status update sent to ${res.count} recipient${res.count !== 1 ? "s" : ""}${wb}`
          );
          onOpenChange(false);
        },
        onError: (err) => toast.error(err.message || "Failed to send update"),
      }
    );
  };

  const live = draft?.progress.stage === "live";
  const css = useMemo(() => STYLES, []);
  const existingIds = useMemo(
    () => new Set([...blockers, ...tasks].map((i) => i.id)),
    [blockers, tasks]
  );

  if (!open || !org) return null;

  return (
    <div className="se-scrim" onClick={() => onOpenChange(false)}>
      <style>{css}</style>
      <div className="se-modal" onClick={(e) => e.stopPropagation()}>
        <div className="se-head">
          <div>
            <div className="se-mono se-accent-t">Send status update</div>
            <div className="se-title">{org.name}</div>
          </div>
          <button className="se-icon-btn" onClick={() => onOpenChange(false)} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {draftQuery.isLoading || !draft ? (
          <div className="se-loading">Loading draft…</div>
        ) : step === "compose" ? (
          <div className="se-body">
            <div className="se-compose">
              <div className="se-field">
                <span className="se-label">To · {recipients.length}</span>
                <div className="se-recip-box">
                  {recipients.map((r) => (
                    <span className="se-recip-chip" key={r.email}>
                      <span>{r.label}</span>
                      <button
                        className="se-recip-x"
                        title={"Remove " + r.email}
                        onClick={() => removeRecipient(r.email)}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    className="se-recip-input"
                    type="text"
                    placeholder={recipients.length ? "Add emails (comma or ; separated)…" : "Add recipient emails…"}
                    value={draftEmail}
                    onChange={(e) => {
                      const v = e.target.value;
                      // If a separator was typed, flush completed emails immediately.
                      if (/[,;]/.test(v)) {
                        const lastSep = Math.max(v.lastIndexOf(","), v.lastIndexOf(";"));
                        addEmails(v.slice(0, lastSep));
                        setDraftEmail(v.slice(lastSep + 1).trimStart());
                      } else {
                        setDraftEmail(v);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && draftEmail) {
                        e.preventDefault();
                        addEmails(draftEmail);
                      }
                      if (e.key === "Backspace" && !draftEmail && recipients.length)
                        removeRecipient(recipients[recipients.length - 1].email);
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (/[,;\n]/.test(text)) {
                        e.preventDefault();
                        addEmails((draftEmail ? draftEmail + "," : "") + text);
                      }
                    }}
                    onBlur={() => draftEmail && addEmails(draftEmail)}
                  />
                </div>
                {draftEmail && !validEmail(draftEmail) && (
                  <span className="se-hint">Enter a valid email — separate multiple with , or ;</span>
                )}
                <span className="se-suggest-lbl" style={{ marginTop: 2 }}>
                  Prepopulated from this site's users &amp; partner admins
                </span>
              </div>

              <div className="se-field">
                <span className="se-label">Include</span>
                <div className="se-chips">
                  {[
                    ["Progress snapshot", incProgress, setIncProgress] as const,
                    ["Blockers", incBlockers, setIncBlockers] as const,
                    ["Tasks & assignments", incTasks, setIncTasks] as const,
                    ["Ask them to reply", promptReply, setPromptReply] as const,
                  ].map(([label, val, set]) => (
                    <button
                      key={label}
                      className={"se-chip" + (val ? " active" : "")}
                      onClick={() => set((v) => !v)}
                    >
                      {val && <Check size={12} />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="se-field">
                <span className="se-label">Note</span>
                <textarea
                  className="se-textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {incBlockers && (
                <div className="se-edit">
                  <div className="se-edit-head">
                    <AlertTriangle size={13} style={{ color: "var(--se-red)" }} /> Blockers
                  </div>
                  <div className="se-list">
                    {blockers.map((b, i) => (
                      <div className="se-row" key={b.id}>
                        <span className="se-grip" />
                        <input
                          className="se-cell"
                          value={b.text}
                          placeholder="Blocker…"
                          onChange={(e) => updateBlocker(i, "text", e.target.value)}
                        />
                        <OwnerSelect
                          value={b.owner}
                          options={assignees}
                          onChange={(v) => updateBlocker(i, "owner", v)}
                        />
                        <button className="se-del" onClick={() => updateBlocker(i, "__delete")}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <CatalogPicker
                      catalog={catalog}
                      existingIds={existingIds}
                      onPick={pickInto(setBlockers, "IT Connectivity")}
                      onCustom={() => addCustom(setBlockers, assignees[0] ?? "IT Connectivity")}
                    />
                  </div>
                </div>
              )}

              {incTasks && (
                <div className="se-edit">
                  <div className="se-edit-head">
                    <ListChecks size={13} style={{ color: "var(--se-accent)" }} /> Tasks &amp; assignments
                  </div>
                  <div className="se-list">
                    {tasks.map((t, i) => (
                      <div className="se-row" key={t.id}>
                        <span className="se-grip" />
                        <input
                          className="se-cell"
                          value={t.text}
                          placeholder="Task…"
                          onChange={(e) => updateTask(i, "text", e.target.value)}
                        />
                        <OwnerSelect
                          value={t.owner}
                          options={assignees}
                          onChange={(v) => updateTask(i, "owner", v)}
                        />
                        <input
                          className="se-cell se-due"
                          value={t.due}
                          placeholder="due"
                          onChange={(e) => updateTask(i, "due", e.target.value)}
                        />
                        <button className="se-del" onClick={() => updateTask(i, "__delete")}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <CatalogPicker
                      catalog={catalog}
                      existingIds={existingIds}
                      onPick={pickInto(setTasks, "Project Manager")}
                      onCustom={() => addCustom(setTasks, assignees[0] ?? "Project Manager")}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* live email preview */}
            <div className="se-preview">
              <div className="se-mono" style={{ marginBottom: 10 }}>
                Preview
              </div>
              <div className="se-mail">
                <div className="se-mail-head">
                  <span className="se-mail-brand">New Lantern</span>
                  <span className="se-mono" style={{ fontSize: 9 }}>
                    Implementation Update
                  </span>
                </div>
                <div className="se-mail-body">
                  <div className="se-mail-subject">{subject}</div>
                  <p className="se-mail-note">{note}</p>

                  {incProgress && (
                    <div className="se-snap">
                      <div className="se-snap-row">
                        <span>Overall progress</span>
                        <b style={{ color: live ? "var(--se-green)" : "var(--se-accent)" }}>
                          {live ? "Live" : draft.progress.overall + "%"}
                        </b>
                      </div>
                      <div className="se-bar">
                        <span style={{ width: draft.progress.overall + "%" }} />
                      </div>
                      <div className="se-snap-grid">
                        <div>
                          <b>
                            {draft.progress.q}/{draft.progress.qTotal}
                          </b>
                          <span>Questionnaire</span>
                        </div>
                        <div>
                          <b>
                            {draft.progress.vPass}/{draft.progress.vTotal}
                          </b>
                          <span>Tests passed</span>
                        </div>
                        <div>
                          <b>
                            {draft.progress.tDone}/{draft.progress.tTotal}
                          </b>
                          <span>Tasks done</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {incBlockers && blockers.length > 0 && (
                    <div className="se-mail-sec">
                      <div className="se-mail-sec-h" style={{ color: "var(--se-red)" }}>
                        Blockers
                      </div>
                      {blockers.map((b) => (
                        <div className="se-mail-item" key={b.id}>
                          <span className="se-dot" style={{ background: "var(--se-red)" }} />
                          <span>{b.text || "—"}</span>
                          <span className="se-owner">{b.owner}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {incTasks && tasks.length > 0 && (
                    <div className="se-mail-sec">
                      <div className="se-mail-sec-h">Tasks &amp; assignments</div>
                      {tasks.map((t) => (
                        <div className="se-mail-item" key={t.id}>
                          <span className="se-dot" />
                          <span>{t.text || "—"}</span>
                          <span className="se-owner">
                            {t.owner}
                            {t.due ? ` · ${t.due}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <span className="se-mail-cta">View your site dashboard →</span>
                  <p className="se-mail-sign">
                    — {senderName}
                    <br />
                    <span className="se-muted">New Lantern Implementation Team</span>
                  </p>
                  {promptReply && (
                    <p className="se-mail-reply">
                      Something look off, or already handled? <b>Just reply to this email</b> — it
                      routes straight to your implementation team.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="se-confirm">
            <div className="se-confirm-ico">
              <Mail size={26} />
            </div>
            <div className="se-confirm-title">
              Send this update to {recipientList.length} recipient
              {recipientList.length !== 1 ? "s" : ""}?
            </div>
            <div className="se-confirm-recips">
              {recipientList.map((r) => (
                <span className="se-badge" key={r}>
                  {r}
                </span>
              ))}
            </div>
            <div className="se-confirm-meta">
              <div className="se-confirm-subj">
                <FileText size={14} className="se-muted" /> {subject}
              </div>
              <div className="se-confirm-flags">
                {incProgress && (
                  <span style={{ color: "var(--se-accent)" }}>
                    <Check size={13} /> Progress
                  </span>
                )}
                {incBlockers && (
                  <span style={{ color: "var(--se-red)" }}>
                    <Check size={13} /> {blockers.length} blockers
                  </span>
                )}
                {incTasks && (
                  <span style={{ color: "var(--se-accent)" }}>
                    <Check size={13} /> {tasks.length} tasks
                  </span>
                )}
                {promptReply && (
                  <span className="se-muted">
                    <Check size={13} /> Reply prompt
                  </span>
                )}
              </div>
            </div>
            <div className="se-authorize">
              <Lock size={13} className="se-muted" /> Sending as <b>{senderName}</b> · you'll be CC'd
              · owners + status save back to the site
            </div>
          </div>
        )}

        {draft && (
          <div className="se-foot">
            {step === "compose" ? (
              <>
                <span className="se-muted se-foot-count">
                  {recipientList.length} recipient{recipientList.length !== 1 ? "s" : ""} selected
                </span>
                <div className="se-foot-actions">
                  <button className="se-btn se-btn-ghost" onClick={() => onOpenChange(false)}>
                    Cancel
                  </button>
                  <button
                    className="se-btn se-btn-primary"
                    disabled={recipientList.length === 0}
                    onClick={() => setStep("confirm")}
                  >
                    Review &amp; send <ArrowRight size={14} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <button className="se-btn se-btn-ghost" onClick={() => setStep("compose")}>
                  <ChevronLeft size={14} /> Back to edit
                </button>
                <button
                  className="se-btn se-btn-primary"
                  disabled={sendMutation.isPending}
                  onClick={handleSend}
                >
                  <Send size={14} /> {sendMutation.isPending ? "Sending…" : "Authorize & send"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const STYLES = `
.se-scrim { position: fixed; inset: 0; z-index: 120; background: rgba(0,0,0,0.66); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 28px; overflow-y: auto;
  --se-accent:#7C1EBD; --se-accent-mid:#8F4FBD; --se-accent-soft:rgba(124,30,189,0.16); --se-accent-softer:rgba(124,30,189,0.08);
  --se-line:rgba(255,255,255,0.08); --se-line2:rgba(255,255,255,0.14); --se-fg:#FFFFFF; --se-muted:#9A9AA0; --se-faint:#6E6E73;
  --se-red:#E53E3E; --se-green:#16A34A; --se-amber:#D97706; --se-bg:#131313; --se-panel:#0E0E10; --se-mail:#0A0A0A;
  font-family: 'Figtree', system-ui, -apple-system, sans-serif; }
.se-modal { width: min(980px, 100%); background: var(--se-bg); border: 1px solid var(--se-line2); border-radius: 16px; box-shadow: 0 24px 70px rgba(0,0,0,0.6); display: flex; flex-direction: column; max-height: calc(100vh - 56px); overflow: hidden; color: var(--se-fg); }
@media (max-width: 640px) { .se-scrim { padding: 0; align-items: stretch; } .se-modal { width: 100%; max-height: 100vh; border-radius: 0; border: none; } .se-body { grid-template-columns: 1fr !important; } .se-preview { display: none !important; } .se-row { flex-wrap: wrap; gap: 4px; } .se-cell { min-width: 100% !important; } .se-select-wrap { max-width: 100% !important; width: 100%; } .se-due { max-width: 100% !important; width: 100%; } .se-foot { flex-direction: column; gap: 8px; } .se-foot-count { text-align: center; } .se-foot-actions { width: 100%; justify-content: stretch; } .se-foot-actions .se-btn { flex: 1; justify-content: center; } .se-confirm { padding: 24px 16px; } .se-recip-chip { max-width: 100%; } .se-recip-chip > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
.se-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--se-line); }
.se-title { font: 800 19px/1.1 'Figtree',sans-serif; letter-spacing: -0.03em; margin-top: 6px; }
.se-mono { font: 400 12px/1 'Roboto Mono',monospace; text-transform: uppercase; letter-spacing: 0.04em; color: var(--se-muted); }
.se-accent-t { color: var(--se-accent); }
.se-icon-btn { width: 32px; height: 32px; flex: none; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--se-line); border-radius: 8px; background: transparent; color: var(--se-muted); cursor: pointer; }
.se-icon-btn:hover { background: rgba(255,255,255,0.06); border-color: var(--se-line2); color: var(--se-fg); }
.se-loading { padding: 60px 20px; text-align: center; color: var(--se-muted); font: 500 14px/1 'Figtree',sans-serif; }
.se-body { display: grid; grid-template-columns: 1fr 0.95fr; gap: 0; overflow: hidden; min-height: 0; }
@media (max-width: 860px) { .se-body { grid-template-columns: 1fr; } .se-preview { display: none; } }
@media (max-width: 640px) { .se-compose { padding: 14px 12px; gap: 12px; } .se-head { padding: 14px 12px; } .se-title { font-size: 16px; } }
.se-compose { padding: 18px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.se-field { display: flex; flex-direction: column; gap: 7px; }
.se-label { font: 400 12px/1 'Roboto Mono',monospace; text-transform: uppercase; color: var(--se-muted); letter-spacing: 0.04em; }
.se-recip-box { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 8px; border: 1px solid var(--se-line); border-radius: 9px; background: var(--se-panel); min-height: 44px; transition: border-color 0.15s; }
.se-recip-box:focus-within { border-color: var(--se-accent); box-shadow: 0 0 0 3px var(--se-accent-soft); }
.se-recip-chip { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 6px 0 11px; border-radius: 999px; background: var(--se-accent-soft); border: 1px solid rgba(124,30,189,0.4); color: var(--se-fg); font: 600 12px/1 'Figtree',sans-serif; }
.se-recip-x { width: 18px; height: 18px; flex: none; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: transparent; color: var(--se-muted); cursor: pointer; }
.se-recip-x:hover { background: rgba(229,62,62,0.2); color: var(--se-red); }
.se-recip-input { flex: 1; min-width: 160px; height: 28px; border: 0; background: transparent; outline: none; color: var(--se-fg); font: 500 13px/1 'Figtree',sans-serif; }
.se-recip-input::placeholder { color: #B4B4B4; }
.se-hint { font: 500 11.5px/1 'Figtree',sans-serif; color: var(--se-amber); margin-top: 2px; }
.se-suggest-lbl { font: 400 11px/1.3 'Roboto Mono',monospace; text-transform: uppercase; color: var(--se-faint); letter-spacing: 0.04em; }
.se-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.se-chip { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 11px; border-radius: 999px; border: 1px solid var(--se-line2); background: transparent; color: var(--se-muted); font: 600 12px/1 'Figtree',sans-serif; cursor: pointer; transition: all 0.15s; }
.se-chip:hover { color: var(--se-fg); border-color: var(--se-line2); }
.se-chip.active { background: var(--se-accent-soft); border-color: rgba(124,30,189,0.5); color: var(--se-accent); }
.se-textarea { min-height: 60px; resize: vertical; border: 1px solid var(--se-line); border-radius: 9px; background: var(--se-panel); padding: 10px 12px; color: var(--se-fg); font: 500 13px/1.5 'Figtree',sans-serif; outline: none; }
.se-textarea:focus { border-color: var(--se-accent); box-shadow: 0 0 0 3px var(--se-accent-soft); }
.se-edit { border: 1px solid var(--se-line); border-radius: 10px; padding: 12px; background: rgba(255,255,255,0.012); }
.se-edit-head { display: flex; align-items: center; gap: 7px; font: 700 12px/1 'Figtree',sans-serif; margin-bottom: 10px; }
.se-list { display: flex; flex-direction: column; gap: 6px; }
.se-row { display: flex; align-items: center; gap: 6px; }
.se-grip { width: 6px; height: 6px; border-radius: 50%; background: var(--se-faint); flex: none; }
.se-cell { flex: 1; min-width: 0; height: 30px; border: 1px solid transparent; border-radius: 6px; background: transparent; padding: 0 8px; color: var(--se-fg); font: 500 13px/1 'Figtree',sans-serif; outline: none; }
.se-cell:hover { background: rgba(255,255,255,0.03); }
.se-cell:focus { border-color: var(--se-accent); background: var(--se-panel); box-shadow: 0 0 0 2px var(--se-accent-soft); }
.se-cell::placeholder { color: #B4B4B4; }
.se-due { max-width: 74px; flex: none; font-family: 'Roboto Mono',monospace; font-size: 12px; }
.se-del { width: 26px; height: 26px; flex: none; border: 0; background: transparent; color: var(--se-muted); border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.se-del:hover { background: rgba(229,62,62,0.16); color: var(--se-red); }
.se-add { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px dashed var(--se-line2); border-radius: 7px; background: transparent; color: var(--se-muted); font: 600 12px/1 'Figtree',sans-serif; cursor: pointer; }
.se-add:hover { color: var(--se-fg); border-color: var(--se-accent); border-style: solid; }
.se-picker { position: relative; margin-top: 4px; }
.se-picker-actions { display: flex; gap: 6px; }
.se-picker-pop { position: absolute; z-index: 5; top: calc(100% + 6px); left: 0; right: 0; background: #15151A; border: 1px solid var(--se-line2); border-radius: 10px; box-shadow: 0 16px 40px rgba(0,0,0,0.55); overflow: hidden; }
.se-picker-search { display: flex; align-items: center; gap: 7px; padding: 9px 11px; border-bottom: 1px solid var(--se-line); }
.se-picker-search input { flex: 1; border: 0; background: transparent; outline: none; color: var(--se-fg); font: 500 13px/1 'Figtree',sans-serif; }
.se-picker-list { max-height: 240px; overflow-y: auto; padding: 6px; }
.se-picker-empty { padding: 16px; text-align: center; color: var(--se-muted); font: 500 12.5px/1 'Figtree',sans-serif; }
.se-picker-item { width: 100%; display: flex; align-items: center; gap: 9px; padding: 8px 9px; border: 0; background: transparent; border-radius: 7px; cursor: pointer; text-align: left; }
.se-picker-item:hover { background: rgba(255,255,255,0.05); }
.se-picker-kind { flex: none; font: 600 9px/1 'Roboto Mono',monospace; text-transform: uppercase; letter-spacing: 0.05em; padding: 3px 6px; border-radius: 5px; }
.se-picker-kind.task { background: var(--se-accent-soft); color: var(--se-accent); }
.se-picker-kind.test { background: rgba(121,209,217,0.16); color: #79D1D9; }
.se-picker-kind.question { background: rgba(217,119,6,0.18); color: #E0A347; }
.se-picker-tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--se-line); }
.se-ptab { font: 600 11px/1 'Figtree',sans-serif; color: var(--se-muted); border: 1px solid var(--se-line2); border-radius: 999px; padding: 5px 10px; background: transparent; cursor: pointer; }
.se-ptab:hover { color: var(--se-fg); }
.se-ptab.on { background: var(--se-accent-soft); border-color: rgba(124,30,189,0.5); color: #B07CE0; }
.se-pgroup { font: 600 10px/1 'Roboto Mono',monospace; text-transform: uppercase; letter-spacing: 0.05em; color: var(--se-faint); padding: 9px 8px 4px; }
.se-picker-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.se-picker-title { font: 600 12.5px/1.2 'Figtree',sans-serif; color: var(--se-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.se-picker-sub { font: 500 10.5px/1.2 'Roboto Mono',monospace; color: var(--se-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.se-select-wrap { position: relative; max-width: 160px; flex: none; }
.se-select { height: 30px; width: 100%; appearance: none; -webkit-appearance: none; border: 1px solid var(--se-line); border-radius: 6px; background: var(--se-panel); padding: 0 26px 0 9px; color: var(--se-fg); font: 500 12px/1 'Figtree',sans-serif; outline: none; cursor: pointer; }
.se-select:focus { border-color: var(--se-accent); }
.se-select-ic { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--se-muted); }
.se-preview { padding: 18px 20px; border-left: 1px solid var(--se-line); background: rgba(0,0,0,0.28); overflow-y: auto; }
.se-mail { background: var(--se-mail); border: 1px solid var(--se-line); border-radius: 12px; overflow: hidden; }
.se-mail-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--se-line); }
.se-mail-brand { font: 800 15px/1 'Figtree',sans-serif; letter-spacing: -0.02em; color: var(--se-fg); }
.se-mail-body { padding: 18px 16px; }
.se-mail-subject { font: 700 15px/1.3 'Figtree',sans-serif; letter-spacing: -0.02em; margin-bottom: 10px; }
.se-mail-note { font: 500 12.5px/1.55 'Figtree',sans-serif; color: #C9C9CE; margin: 0 0 14px; white-space: pre-line; }
.se-snap { border: 1px solid var(--se-line); border-radius: 10px; padding: 12px 13px; margin-bottom: 14px; }
.se-snap-row { display: flex; align-items: center; justify-content: space-between; font: 600 12.5px/1 'Figtree',sans-serif; }
.se-snap-row b { font-size: 14px; letter-spacing: -0.02em; }
.se-bar { height: 5px; background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden; margin: 6px 0 12px; }
.se-bar > span { display: block; height: 100%; background: var(--se-accent); border-radius: 99px; }
.se-snap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.se-snap-grid > div { display: flex; flex-direction: column; gap: 3px; }
.se-snap-grid b { font: 800 16px/1 'Figtree',sans-serif; letter-spacing: -0.03em; }
.se-snap-grid span { font: 600 9.5px/1.2 'Roboto Mono',monospace; text-transform: uppercase; color: var(--se-muted); letter-spacing: 0.03em; }
.se-mail-sec { margin-bottom: 14px; }
.se-mail-sec-h { font: 400 12px/1 'Roboto Mono',monospace; text-transform: uppercase; letter-spacing: 0.04em; color: var(--se-muted); margin-bottom: 8px; }
.se-mail-item { display: flex; align-items: center; gap: 8px; font: 500 12px/1.4 'Figtree',sans-serif; padding: 5px 0; border-bottom: 1px solid var(--se-line); }
.se-mail-item:last-child { border-bottom: 0; }
.se-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--se-accent); flex: none; }
.se-mail-item > span:nth-child(2) { flex: 1; }
.se-owner { font: 600 10.5px/1 'Roboto Mono',monospace; color: var(--se-muted); white-space: nowrap; flex: none; }
.se-mail-cta { display: inline-block; margin-top: 4px; background: var(--se-accent); color: #fff; font: 600 12.5px/1 'Figtree',sans-serif; padding: 10px 14px; border-radius: 8px; }
.se-mail-sign { font: 500 12.5px/1.55 'Figtree',sans-serif; color: #C9C9CE; margin: 16px 0 0; }
.se-mail-reply { font: 500 12px/1.55 'Figtree',sans-serif; color: var(--se-muted); margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--se-line); }
.se-mail-reply b { color: var(--se-fg); }
.se-confirm { padding: 32px 28px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; overflow-y: auto; }
.se-confirm-ico { width: 54px; height: 54px; border-radius: 14px; background: var(--se-accent-soft); color: var(--se-accent); display: inline-flex; align-items: center; justify-content: center; }
.se-confirm-title { font: 700 18px/1.25 'Figtree',sans-serif; letter-spacing: -0.025em; max-width: 380px; }
.se-confirm-recips { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; }
.se-badge { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid var(--se-line); font: 600 12px/1 'Roboto Mono',monospace; color: var(--se-fg); }
.se-confirm-meta { border: 1px solid var(--se-line); border-radius: 11px; padding: 14px 16px; text-align: left; width: 100%; max-width: 460px; margin-top: 6px; }
.se-confirm-subj { display: flex; align-items: center; gap: 8px; font: 600 13px/1.3 'Figtree',sans-serif; }
.se-confirm-flags { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 8px; }
.se-confirm-flags > span { display: inline-flex; align-items: center; gap: 5px; font: 600 12.5px/1 'Figtree',sans-serif; }
.se-authorize { display: inline-flex; align-items: center; gap: 7px; font: 500 12px/1.4 'Figtree',sans-serif; color: var(--se-muted); margin-top: 6px; text-align: center; }
.se-authorize b { color: var(--se-fg); }
.se-muted { color: var(--se-muted); }
.se-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-top: 1px solid var(--se-line); background: rgba(0,0,0,0.25); }
.se-foot-count { font-size: 12.5px; }
.se-foot-actions { display: flex; gap: 8px; }
.se-btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 8px; font: 600 13px/1 'Figtree',sans-serif; border: 1px solid transparent; cursor: pointer; transition: all 0.15s; }
.se-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.se-btn-primary { background: var(--se-accent); color: #fff; }
.se-btn-primary:not(:disabled):hover { background: var(--se-accent-mid); }
.se-btn-ghost { background: transparent; color: var(--se-muted); }
.se-btn-ghost:hover { background: rgba(255,255,255,0.06); color: var(--se-fg); }
`;
