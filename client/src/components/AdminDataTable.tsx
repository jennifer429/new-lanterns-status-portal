import { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  label: string;
  /** Extract the display value for this column from a row */
  getValue: (row: T) => string | number | null | undefined;
  /** Optional custom render. Falls back to getValue() text */
  render?: (row: T) => React.ReactNode;
  /** Whether this column is sortable. Defaults to true */
  sortable?: boolean;
  /** Whether this column is searchable. Defaults to true */
  searchable?: boolean;
  /** Column width as CSS value (e.g. '20%', '120px') */
  width?: string;
}

interface AdminDataTableProps<T> {
  /** Column definitions */
  columns: Column<T>[];
  /** Row data */
  data: T[];
  /** Unique key extractor for each row */
  getRowKey: (row: T) => string | number;
  /** Optional row class name (e.g. for opacity on inactive rows) */
  rowClassName?: (row: T) => string;
  /** Optional actions column render */
  renderActions?: (row: T) => React.ReactNode;
  /** Table section title (e.g. "Active Users (12)") */
  title?: string;
  /** CSV export filename (without .csv). If provided, shows export button */
  exportFilename?: string;
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Whether to show the search bar. Defaults to true */
  showSearch?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AdminDataTable<T>({
  columns,
  data,
  getRowKey,
  rowClassName,
  renderActions,
  title,
  exportFilename,
  searchPlaceholder = "Search...",
  showSearch = true,
  emptyMessage = "No data",
}: AdminDataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── Search (real-time, no enter required) ──────────────────────────────────

  const searchableKeys = useMemo(
    () => columns.filter((c) => c.searchable !== false),
    [columns]
  );

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) =>
      searchableKeys.some((col) => {
        const val = col.getValue(row);
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, searchQuery, searchableKeys]);

  // ── Sort ────────────────────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = col.getValue(a);
      const bVal = col.getValue(b);

      // Nulls last
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp: number;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), undefined, {
          sensitivity: "base",
        });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  // ── CSV Export ──────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const header = columns.map((c) => c.label).join(",");
    const rows = sorted.map((row) =>
      columns
        .map((c) => {
          const val = c.getValue(row);
          const str = val == null ? "" : String(val);
          // Escape commas and quotes
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, columns, exportFilename]);

  // ── Sort icon helper ───────────────────────────────────────────────────────

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey)
      return <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-2.5 h-2.5 text-primary" />
    ) : (
      <ArrowDown className="w-2.5 h-2.5 text-primary" />
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const allColumns = renderActions
    ? [...columns, { key: "__actions", label: "", width: "14%", sortable: false, searchable: false, getValue: () => null } as Column<T>]
    : columns;

  return (
    <Card className="overflow-hidden">
      {/* Toolbar: title + search + export */}
      <div className="px-4 py-2.5 border-b border-border/30 bg-muted/10 flex items-center justify-between gap-3">
        {title && (
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
            {title}
          </h3>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-7 h-7 text-xs w-[200px]"
              />
            </div>
          )}
          {exportFilename && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-7 text-xs gap-1"
            >
              <Download className="w-3 h-3" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <table
        className="w-full border-collapse text-xs"
        style={{ tableLayout: "fixed" }}
      >
        <colgroup>
          {allColumns.map((col) => (
            <col key={col.key} style={{ width: col.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-border/30 bg-muted/15">
            {allColumns.map((col) => {
              const isSortable = col.sortable !== false && col.key !== "__actions";
              return (
                <th
                  key={col.key}
                  className={`text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide ${
                    isSortable
                      ? "cursor-pointer select-none hover:text-foreground transition-colors"
                      : ""
                  }`}
                  onClick={isSortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {isSortable && <SortIcon colKey={col.key} />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={allColumns.length}
                className="text-center py-8 text-xs text-muted-foreground italic"
              >
                {searchQuery ? `No results for "${searchQuery}"` : emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={getRowKey(row)}
                className={`border-b border-border/20 hover:bg-muted/20 transition-colors ${
                  rowClassName ? rowClassName(row) : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-1.5 truncate">
                    {col.render ? col.render(row) : (col.getValue(row) ?? "—")}
                  </td>
                ))}
                {renderActions && (
                  <td className="px-2 py-1">{renderActions(row)}</td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Footer with count */}
      {sorted.length > 0 && searchQuery && (
        <div className="px-4 py-1.5 border-t border-border/30 bg-muted/5">
          <span className="text-[10px] text-muted-foreground">
            Showing {sorted.length} of {data.length}
          </span>
        </div>
      )}
    </Card>
  );
}
