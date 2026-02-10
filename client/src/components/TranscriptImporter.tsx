import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Loader2, ChevronDown, ChevronUp, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TranscriptImporterProps {
  organizationSlug: string;
  onImportComplete?: () => void;
}

export function TranscriptImporter({ organizationSlug, onImportComplete }: TranscriptImporterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<{
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
  } | null>(null);

  const processTranscript = trpc.intakeAi.processTranscript.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Successfully processed transcript!`, {
        description: `${data.importedCount} new responses, ${data.updatedCount} updated`,
      });
      if (onImportComplete) {
        onImportComplete();
      }
    },
    onError: (error) => {
      toast.error('Failed to process transcript', {
        description: error.message,
      });
    },
  });

  const handleImport = async () => {
    if (!transcript.trim()) {
      toast.error('Please enter a transcript');
      return;
    }

    setResult(null);
    processTranscript.mutate({
      organizationSlug,
      transcript,
    });
  };

  const handleClear = () => {
    setTranscript('');
    setResult(null);
  };

  return (
    <Card className="border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-purple-800/20 overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-purple-500/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              AI Transcript Import
              <span className="text-xs font-normal text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full">
                Beta
              </span>
            </h3>
            <p className="text-sm text-muted-foreground">
              Paste a call transcript and let AI auto-fill the questionnaire
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && !isExpanded && (
            <div className="flex items-center gap-2 mr-4">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">
                {result.importedCount + result.updatedCount} responses imported
              </span>
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-4 border-t border-purple-500/20">
          {/* Instructions */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-semibold text-white">How it works:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Paste a transcript from a call or meeting below</li>
                  <li>AI will analyze the content and extract relevant answers</li>
                  <li>Responses will be automatically saved to the questionnaire</li>
                  <li>You can review and edit any answers afterward</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Transcript Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">
              Transcript
            </label>
            <Textarea
              placeholder="Paste your call transcript here...

Example:
'Hi, this is John Smith from Memorial Hospital. Our administrative contact is Jane Doe at jane@memorial.com. For IT, we have Mike Johnson handling connectivity. Our EHR system is Epic, and we're currently using Sectra PACS. We're targeting a go-live date of March 15, 2026...'"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={12}
              className="!bg-black/50 !text-white border-purple-500/30 focus:border-purple-500 resize-none font-mono text-sm"
              disabled={processTranscript.isPending}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{transcript.length} characters</span>
              {transcript.length > 0 && (
                <span className="text-purple-400">
                  {transcript.split(/\s+/).filter(w => w.length > 0).length} words
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleImport}
              disabled={processTranscript.isPending || !transcript.trim()}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              {processTranscript.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Process Transcript
                </>
              )}
            </Button>
            <Button
              onClick={handleClear}
              variant="outline"
              disabled={processTranscript.isPending}
              className="border-purple-500/30 hover:bg-purple-500/10"
            >
              Clear
            </Button>
          </div>

          {/* Results Display */}
          {result && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <h4 className="font-semibold text-green-400">Import Successful!</h4>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-black/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{result.importedCount}</div>
                  <div className="text-xs text-muted-foreground mt-1">New Responses</div>
                </div>
                <div className="bg-black/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">{result.updatedCount}</div>
                  <div className="text-xs text-muted-foreground mt-1">Updated</div>
                </div>
                <div className="bg-black/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-400">{result.skippedCount}</div>
                  <div className="text-xs text-muted-foreground mt-1">Skipped</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Scroll through the questionnaire to review the imported answers
              </p>
            </div>
          )}

          {/* Processing Indicator */}
          {processTranscript.isPending && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-white mb-1">AI is analyzing your transcript...</p>
                  <p>This may take 10-30 seconds depending on transcript length.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
