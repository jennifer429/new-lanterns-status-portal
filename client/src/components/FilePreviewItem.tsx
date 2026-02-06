import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Download, Eye, ChevronDown } from "lucide-react";

interface FilePreviewItemProps {
  file: {
    id: number;
    fileName: string;
    fileUrl: string;
    fileSize: number | null;
    createdAt: Date;
  };
}

export function FilePreviewItem({ file }: FilePreviewItemProps) {
  const [showPreview, setShowPreview] = useState(false);
  const fileExt = file.fileName.split('.').pop()?.toLowerCase();
  const canPreview = ['csv', 'txt'].includes(fileExt || '');
  
  const preview = trpc.intake.previewFile.useQuery(
    { fileUrl: file.fileUrl, fileName: file.fileName },
    { enabled: showPreview && canPreview }
  );
  
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between p-2 bg-muted/30">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB • ` : ''}{new Date(file.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canPreview && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-purple-600 hover:text-purple-700"
              title="Preview file"
            >
              {showPreview ? <ChevronDown className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          <a
            href={file.fileUrl}
            download={file.fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:text-purple-700"
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>
      
      {showPreview && canPreview && (
        <div className="p-3 bg-background border-t border-border">
          {preview.isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            </div>
          )}
          
          {preview.data?.supported && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">
                  Showing {preview.data.previewLines} of {preview.data.totalLines} lines
                </p>
              </div>
              
              {preview.data.fileType === 'csv' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <tbody>
                      {preview.data.content?.split('\n').map((line, idx) => {
                        const cells = line.split(',');
                        return (
                          <tr key={idx} className={idx === 0 ? 'bg-muted font-medium' : ''}>
                            {cells.map((cell, cellIdx) => (
                              <td key={cellIdx} className="border border-border px-2 py-1">
                                {cell.trim()}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                  {preview.data.content?.split('\n').map((line, idx) => (
                    <div key={idx} className="flex">
                      <span className="text-muted-foreground mr-3 select-none">{idx + 1}</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </pre>
              )}
            </div>
          )}
          
          {preview.data && !preview.data.supported && (
            <p className="text-xs text-muted-foreground py-2">{preview.data.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
