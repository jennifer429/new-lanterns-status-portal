/**
 * ContactsTable — Dynamic contacts display from Notion (via MySQL cache).
 *
 * Source of truth: Notion Contacts v2 database.
 * Sync: Notion → MySQL (cron every 5 min), Portal → Notion + MySQL (dual-write on save).
 *
 * Supports:
 * - Viewing all contacts for the org (any number of roles)
 * - Inline editing (name, role, email, phone, notes)
 * - Adding new contacts
 * - Archiving contacts
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

interface ContactsTableProps {
  slug: string;
}

interface EditingContact {
  id: number | null; // null = new row
  name: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
}

const emptyContact: EditingContact = {
  id: null,
  name: "",
  role: "",
  email: "",
  phone: "",
  notes: "",
};

export function ContactsTable({ slug }: ContactsTableProps) {
  const { isAuthenticated } = useAuth();
  const [editing, setEditing] = useState<EditingContact | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { data, isLoading, refetch } = trpc.contacts.getForOrg.useQuery(
    { organizationSlug: slug },
    { enabled: !!slug }
  );

  const createMutation = trpc.contacts.createRow.useMutation({
    onSuccess: () => {
      toast.success("Contact added");
      setIsAdding(false);
      setEditing(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.contacts.updateRow.useMutation({
    onSuccess: () => {
      toast.success("Contact updated");
      setEditing(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const archiveMutation = trpc.contacts.archiveRow.useMutation({
    onSuccess: () => {
      toast.success("Contact removed");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (editing.id === null) {
      // Creating new
      createMutation.mutate({
        organizationSlug: slug,
        contact: {
          name: editing.name.trim(),
          role: editing.role.trim(),
          email: editing.email.trim(),
          phone: editing.phone.trim(),
          notes: editing.notes.trim(),
        },
      });
    } else {
      // Updating existing
      updateMutation.mutate({
        id: editing.id,
        organizationSlug: slug,
        contact: {
          name: editing.name.trim(),
          role: editing.role.trim(),
          email: editing.email.trim(),
          phone: editing.phone.trim(),
          notes: editing.notes.trim(),
        },
      });
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setIsAdding(false);
  };

  const handleStartAdd = () => {
    setEditing({ ...emptyContact });
    setIsAdding(true);
  };

  const handleStartEdit = (contact: {
    id: number;
    name: string;
    role: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
  }) => {
    setEditing({
      id: contact.id,
      name: contact.name,
      role: contact.role || "",
      email: contact.email || "",
      phone: contact.phone || "",
      notes: contact.notes || "",
    });
    setIsAdding(false);
  };

  if (isLoading) {
    return (
      <div className="col-span-2 flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading contacts...
      </div>
    );
  }

  const rows = data?.rows || [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Group contacts by role for display
  const roleGroups = new Map<string, typeof rows>();
  for (const row of rows) {
    const role = row.role || "Other";
    if (!roleGroups.has(role)) roleGroups.set(role, []);
    roleGroups.get(role)!.push(row);
  }

  const cellClass =
    "h-8 text-sm bg-transparent border-0 shadow-none rounded focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:bg-primary/5";

  return (
    <div className="col-span-2 rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
            {rows.length} contact{rows.length !== 1 ? "s" : ""} · syncs from Notion
          </span>
        </div>
        {isAuthenticated && !editing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleStartAdd}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground w-36">
                Role
              </th>
              <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground w-44">
                Name
              </th>
              <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground w-52">
                Email
              </th>
              <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground w-32">
                Phone
              </th>
              <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Notes
              </th>
              {isAuthenticated && (
                <th className="w-16" />
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((contact, idx) => {
              const isEditingThis = editing?.id === contact.id && !isAdding;

              if (isEditingThis) {
                return (
                  <tr key={contact.id} className="bg-primary/5">
                    <td className="px-2 py-1">
                      <Input
                        value={editing.role}
                        onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                        placeholder="Role"
                        className={cellClass}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        placeholder="Full name"
                        className={cellClass}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={editing.email}
                        onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                        placeholder="email@org.com"
                        className={cn(cellClass, "font-mono")}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={editing.phone}
                        onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                        placeholder="(000) 000-0000"
                        className={cn(cellClass, "font-mono")}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={editing.notes}
                        onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                        placeholder="Notes..."
                        className={cellClass}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-emerald-500 hover:text-emerald-600"
                          onClick={handleSave}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground"
                          onClick={handleCancel}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={contact.id}
                  className={cn(
                    idx % 2 === 1 ? "bg-muted/10" : "",
                    "group hover:bg-muted/20 transition-colors"
                  )}
                >
                  <td className="px-3 py-1.5 align-middle">
                    <span className="text-xs font-medium text-primary/80">
                      {contact.role || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 align-middle">
                    <span className="text-sm font-medium text-foreground">
                      {contact.name}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 align-middle">
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-sm font-mono text-primary/80 hover:text-primary transition-colors"
                      >
                        {contact.email}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 align-middle">
                    <span className="text-sm font-mono text-muted-foreground">
                      {contact.phone || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 align-middle">
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {contact.notes || "—"}
                    </span>
                  </td>
                  {isAuthenticated && (
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleStartEdit(contact)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Remove ${contact.name}?`)) {
                              archiveMutation.mutate({ id: contact.id });
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {/* Add new row (inline) */}
            {isAdding && editing && (
              <tr className="bg-primary/5">
                <td className="px-2 py-1">
                  <Input
                    value={editing.role}
                    onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                    placeholder="Role (e.g. IT, Admin)"
                    className={cellClass}
                    autoFocus
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Full name"
                    className={cellClass}
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    placeholder="email@org.com"
                    className={cn(cellClass, "font-mono")}
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={editing.phone}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    placeholder="(000) 000-0000"
                    className={cn(cellClass, "font-mono")}
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={editing.notes}
                    onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                    placeholder="Notes..."
                    className={cellClass}
                  />
                </td>
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-emerald-500 hover:text-emerald-600"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground"
                      onClick={handleCancel}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty state */}
            {rows.length === 0 && !isAdding && (
              <tr>
                <td colSpan={isAuthenticated ? 6 : 5} className="px-3 py-6 text-center text-muted-foreground text-sm">
                  No contacts yet.{" "}
                  {isAuthenticated && (
                    <button
                      className="text-primary hover:underline"
                      onClick={handleStartAdd}
                    >
                      Add the first contact
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
