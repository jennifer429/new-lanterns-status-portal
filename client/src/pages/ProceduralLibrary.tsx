import { useMemo, useState, useRef, useCallback, type DragEvent } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRoute } from "wouter";
import { Link } from "wouter";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  Download,
  ExternalLink,
  Trash2,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  X,
  Eye,
  Clock,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

type SortDir = "asc" | "desc";
type SortField = "title" | "partnerName" | "uploadedByName" | "createdAt" | "size";

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <FileImage className="w-5 h-5 text-blue-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv") || mimeType.includes("excel"))
    return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  if (mimeType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText className="w-5 h-5 text-blue-600" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ProceduralLibrary() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isPlatformAdmin = isAdmin && !user?.clientId;

  // Detect route context for back navigation
  const [, orgParams] = useRoute("/org/:clientSlug/:slug/library");
  const [, partnerAdminParams] = useRoute("/org/:slug/admin/library");
  const backPath = orgParams
    ? `/org/${orgParams.clientSlug}/${orgParams.slug}`
    : partnerAdminParams
      ? `/org/${partnerAdminParams.slug}/admin`
      : "/org/admin";

  // Data queries
  const { data: documents = [], refetch: refetchDocs } =
    trpc.proceduralLibrary.listDocuments.useQuery();
  const { data: allClients = [] } = trpc.admin.getAllClients.useQuery(
    undefined,
    { enabled: isPlatformAdmin }
  );

  // Mutations
  const uploadMutation = trpc.proceduralLibrary.uploadDocument.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      refetchDocs();
      setIsUploadOpen(false);
      resetUploadForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.proceduralLibrary.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      refetchDocs();
    },
    onError: (err) => toast.error(err.message),
  });

  const logAuditMutation = trpc.proceduralLibrary.logAudit.useMutation();
  const trpcUtils = trpc.useUtils();

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Upload dialog state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadClientId, setUploadClientId] = useState<string>(
    user?.clientId ? String(user.clientId) : ""
  );
  const [uploadFile, setUploadFile] = useState<globalThis.File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audit trail dialog state
  const [auditDocId, setAuditDocId] = useState<number | null>(null);
  const { data: auditTrail = [] } = trpc.proceduralLibrary.getAuditTrail.useQuery(
    { documentId: auditDocId! },
    { enabled: auditDocId !== null }
  );

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);

  // Delete confirmation
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);

  const resetUploadForm = () => {
    setUploadTitle("");
    setUploadClientId(user?.clientId ? String(user.clientId) : "");
    setUploadFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 ml-1 text-primary" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 ml-1 text-primary" />
    );
  };

  // Filter + sort documents
  const filteredDocs = useMemo(() => {
    let result = [...documents];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (doc) =>
          doc.title.toLowerCase().includes(q) ||
          doc.filename.toLowerCase().includes(q) ||
          doc.uploadedByName.toLowerCase().includes(q) ||
          ("partnerName" in doc && typeof doc.partnerName === "string" && doc.partnerName.toLowerCase().includes(q))
      );
    }

    // Partner filter (platform admins only)
    if (partnerFilter !== "all") {
      const cId = parseInt(partnerFilter);
      result = result.filter((doc) => doc.clientId === cId);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "partnerName": {
          const aName = "partnerName" in a ? (a as any).partnerName : "";
          const bName = "partnerName" in b ? (b as any).partnerName : "";
          cmp = aName.localeCompare(bName);
          break;
        }
        case "uploadedByName":
          cmp = a.uploadedByName.localeCompare(b.uploadedByName);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "size":
          cmp = a.size - b.size;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [documents, searchQuery, partnerFilter, sortField, sortDir]);

  // Unique partners from documents (for the filter dropdown)
  const partnerOptions = useMemo(() => {
    const map = new Map<number, string>();
    documents.forEach((doc) => {
      if ("partnerName" in doc && typeof doc.partnerName === "string") {
        map.set(doc.clientId, doc.partnerName);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [documents]);

  // Upload handler
  const handleUpload = useCallback(async () => {
    if (!uploadFile || !uploadTitle.trim()) {
      toast.error("Please provide a title and select a file");
      return;
    }
    if (isPlatformAdmin && !uploadClientId) {
      toast.error("Please select a partner");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        title: uploadTitle.trim(),
        fileName: uploadFile.name,
        fileData: base64,
        mimeType: uploadFile.type || "application/octet-stream",
        ...(isPlatformAdmin && uploadClientId ? { clientId: parseInt(uploadClientId) } : {}),
      });
    };
    reader.readAsDataURL(uploadFile);
  }, [uploadFile, uploadTitle, uploadClientId, isPlatformAdmin, uploadMutation]);

  // Fetch a fresh URL server-side then open it — prevents stale pre-signed URLs
  const openDoc = async (doc: (typeof documents)[0], action: "download" | "view") => {
    try {
      const { url } = await trpcUtils.proceduralLibrary.getDownloadUrl.fetch({ documentId: doc.id });
      logAuditMutation.mutate({ documentId: doc.id, action });
      window.open(url, "_blank");
    } catch {
      toast.error("Could not open file. Please try again.");
    }
  };

  const handleDownload = (doc: (typeof documents)[0]) => openDoc(doc, "download");
  const handleView = (doc: (typeof documents)[0]) => openDoc(doc, "view");

  // Drag-and-drop handlers for upload zone
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setUploadFile(file);
  }, []);

  return (
    <div className="min-h-screen bg-background animate-page-in">
      {/* ── Glass Header ── */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/images/new-lantern-logo.png" alt="New Lantern" className="h-8 flex-shrink-0" />
            <div className="hidden sm:block border-l border-border/40 pl-3 min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">Document Library</div>
              <p className="text-xs text-muted-foreground truncate">
                Operational and procedural documents
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={backPath}>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <UserMenu
              extraItems={
                isAdmin
                  ? [
                      {
                        label: "Upload Document",
                        icon: <Upload className="w-4 h-4 mr-2" />,
                        onClick: () => setIsUploadOpen(true),
                      },
                    ]
                  : undefined
              }
            />
          </div>
        </div>
      </header>

      {/* Search & Filter Bar */}
      <div className="container py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents by title, filename, or uploader..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {isPlatformAdmin && partnerOptions.length > 1 && (
            <Select value={partnerFilter} onValueChange={setPartnerFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Partners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Partners</SelectItem>
                {partnerOptions.map(([id, name]) => (
                  <SelectItem key={id} value={String(id)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-muted-foreground">
            {filteredDocs.length} document{filteredDocs.length !== 1 ? "s" : ""}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
          {/* Mobile sort control */}
          <div className="sm:hidden">
            <Select value={`${sortField}-${sortDir}`} onValueChange={(val) => {
              const [f, d] = val.split("-") as [SortField, SortDir];
              setSortField(f);
              setSortDir(d);
            }}>
              <SelectTrigger className="h-8 text-xs w-[130px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">Newest first</SelectItem>
                <SelectItem value="createdAt-asc">Oldest first</SelectItem>
                <SelectItem value="title-asc">Title A-Z</SelectItem>
                <SelectItem value="title-desc">Title Z-A</SelectItem>
                <SelectItem value="size-desc">Largest</SelectItem>
                <SelectItem value="size-asc">Smallest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="container pb-8">
        {filteredDocs.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-lg font-medium">No documents found</p>
                <p className="text-sm mt-1">
                  {documents.length === 0
                    ? isAdmin
                      ? "Upload your first document to get started."
                      : "No documents have been shared yet."
                    : "Try adjusting your search or filter."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="sm:hidden space-y-2">
              {filteredDocs.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">{getFileIcon(doc.mimeType)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{doc.title}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                          {"partnerName" in doc && (
                            <Badge variant="secondary" className="text-[10px]">{(doc as any).partnerName}</Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground">{formatDate(doc.createdAt)}</span>
                          <span className="text-[11px] text-muted-foreground">{formatSize(doc.size)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/60 mt-1 truncate">{doc.filename}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30">
                      <Button variant="ghost" size="sm" onClick={() => handleView(doc)} className="h-7 text-xs gap-1">
                        <ExternalLink className="w-3.5 h-3.5" /> Open
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)} className="h-7 text-xs gap-1">
                        <Download className="w-3.5 h-3.5" /> Download
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setAuditDocId(doc.id)} className="h-7 text-xs gap-1 ml-auto">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteDocId(doc.id)} className="h-7 text-xs gap-1 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop table layout */}
            <Card className="hidden sm:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>
                        <button className="flex items-center font-medium hover:text-foreground transition-colors" onClick={() => handleSort("title")}>
                          Document Name <SortIcon field="title" />
                        </button>
                      </TableHead>
                      {isPlatformAdmin && (
                        <TableHead>
                          <button className="flex items-center font-medium hover:text-foreground transition-colors" onClick={() => handleSort("partnerName")}>
                            Partner <SortIcon field="partnerName" />
                          </button>
                        </TableHead>
                      )}
                      <TableHead>
                        <button className="flex items-center font-medium hover:text-foreground transition-colors" onClick={() => handleSort("uploadedByName")}>
                          Uploaded By <SortIcon field="uploadedByName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="flex items-center font-medium hover:text-foreground transition-colors" onClick={() => handleSort("createdAt")}>
                          Date <SortIcon field="createdAt" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="flex items-center font-medium hover:text-foreground transition-colors" onClick={() => handleSort("size")}>
                          Size <SortIcon field="size" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map((doc) => (
                      <TableRow key={doc.id} className="group">
                        <TableCell>{getFileIcon(doc.mimeType)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{doc.title}</p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">{doc.filename}</p>
                          </div>
                        </TableCell>
                        {isPlatformAdmin && (
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {(doc as any).partnerName}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-sm text-muted-foreground">{doc.uploadedByName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(doc.createdAt)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatSize(doc.size)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleView(doc)} title="Open in new tab">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)} title="Download">
                              <Download className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => setAuditDocId(doc.id)} title="View audit trail">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setDeleteDocId(doc.id)} title="Delete" className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ====== UPLOAD DIALOG ====== */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add a document to the library.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Partner selector for platform admins */}
            {isPlatformAdmin && (
              <div>
                <Label htmlFor="upload-partner">Partner *</Label>
                <Select value={uploadClientId} onValueChange={setUploadClientId}>
                  <SelectTrigger id="upload-partner">
                    <SelectValue placeholder="Select a partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {allClients
                      .filter((c) => c.status === "active")
                      .map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Partner name display for partner admins */}
            {!isPlatformAdmin && user?.clientId && (
              <div>
                <Label>Partner</Label>
                <Input
                  value={allClients.find((c) => c.id === user.clientId)?.name ?? "Your Partner"}
                  disabled
                  className="bg-muted"
                />
              </div>
            )}

            <div>
              <Label htmlFor="upload-title">Title *</Label>
              <Input
                id="upload-title"
                placeholder="e.g., VPN Setup Guide"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>File *</Label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-1.5 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : uploadFile
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-border hover:border-muted-foreground/50 hover:bg-muted/20"
                }`}
              >
                {uploadFile ? (
                  <div className="flex items-center gap-2 text-sm">
                    {getFileIcon(uploadFile.type || "application/octet-stream")}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{uploadFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(uploadFile.size)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground/50" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-muted-foreground">
                        Drag & drop a file here
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        or click to browse
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsUploadOpen(false);
                  resetUploadForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={
                  uploadMutation.isPending ||
                  !uploadFile ||
                  !uploadTitle.trim() ||
                  (isPlatformAdmin && !uploadClientId)
                }
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== AUDIT TRAIL DIALOG ====== */}
      <Dialog open={auditDocId !== null} onOpenChange={() => setAuditDocId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit Trail</DialogTitle>
            <DialogDescription>
              Activity log for this document.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 max-h-[400px] overflow-y-auto">
            {auditTrail.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No activity recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {auditTrail.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border border-border"
                  >
                    <div className="mt-0.5">
                      {entry.action === "upload" && (
                        <Upload className="w-4 h-4 text-green-500" />
                      )}
                      {entry.action === "view" && <Eye className="w-4 h-4 text-blue-500" />}
                      {entry.action === "download" && (
                        <Download className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{entry.userName}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {entry.action}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entry.userEmail}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(entry.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== DELETE CONFIRMATION DIALOG ====== */}
      <Dialog open={deleteDocId !== null} onOpenChange={() => setDeleteDocId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDocId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteDocId) {
                  deleteMutation.mutate({ id: deleteDocId });
                  setDeleteDocId(null);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
