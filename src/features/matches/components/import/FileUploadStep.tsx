import { useRef, useState } from 'react';
import { Upload, FileText, Clipboard, AlertCircle } from 'lucide-react';
import { Button, Textarea } from '@/components/ui';
import { extractPdfText } from '../../import/extractPdfText';

export type IngestionMode = 'file' | 'paste';

export function FileUploadStep({
  onFileLoaded,
  onCancel,
}: {
  onFileLoaded: (content: string, filename: string, fileType: 'pdf' | 'csv' | 'text') => void;
  onCancel: () => void;
  /** @deprecated Kept for backwards compatibility */
  isCsv?: boolean;
}) {
  const [mode, setMode] = useState<IngestionMode>('file');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    const nameLower = file.name.toLowerCase();
    const isPdf = nameLower.endsWith('.pdf');
    const isCsv = nameLower.endsWith('.csv') || nameLower.endsWith('.txt');

    if (!isPdf && !isCsv) {
      setError('Please select a valid CricHeroes file (.pdf, .csv, or .txt)');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('File size exceeds maximum limit of 15MB');
      return;
    }

    setError(null);
    setIsParsing(true);

    try {
      if (isPdf) {
        const result = await extractPdfText(file);
        setIsParsing(false);
        if (!result || result.trim().length === 0) {
          setError(
            "We couldn't identify a CricHeroes scorecard in this PDF. Please export the match scorecard from CricHeroes and try again.",
          );
          return;
        }
        onFileLoaded(result, file.name, 'pdf');
      } else {
        const text = await file.text();
        setIsParsing(false);
        if (!text || text.trim().length === 0) {
          setError('The uploaded CSV file appears to be empty.');
          return;
        }
        onFileLoaded(text, file.name, 'csv');
      }
    } catch (err) {
      setIsParsing(false);
      console.error('[FileUploadStep] Failed to extract file text:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(
        `Failed to read scorecard: ${msg}. You can also use the "Paste Scorecard Text" tab above as a fast alternative.`,
      );
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void processFile(e.dataTransfer.files[0]);
    }
  }

  function handlePasteSubmit() {
    if (!pastedText.trim()) {
      setError('Please paste scorecard text to continue.');
      return;
    }
    setError(null);
    onFileLoaded(pastedText.trim(), 'pasted-scorecard.txt', 'text');
  }

  return (
    <div className="space-y-5">
      {/* Tab Switcher */}
      <div className="bg-surface-muted border-border-subtle flex rounded-xl border p-1">
        <button
          type="button"
          onClick={() => {
            setMode('file');
            setError(null);
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-colors ${
            mode === 'file' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
          }`}
        >
          <Upload className="text-primary h-4 w-4" />
          Upload PDF / CSV
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('paste');
            setError(null);
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-colors ${
            mode === 'paste' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
          }`}
        >
          <Clipboard className="text-primary h-4 w-4" />
          Paste Scorecard Text
        </button>
      </div>

      {error && (
        <div className="border-danger/30 bg-danger/10 text-danger flex items-center gap-2.5 rounded-xl border p-3.5 text-left text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {mode === 'file' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
            dragActive
              ? 'border-primary bg-primary/10 scale-[0.99]'
              : 'border-border-subtle hover:border-primary/50 bg-surface/50'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="bg-primary/10 text-primary border-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl border">
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <p className="font-heading text-fg text-base font-extrabold tracking-tight uppercase">
                Drag & Drop CricHeroes File
              </p>
              <p className="text-fg-muted mt-0.5 font-sans text-xs">
                Supports PDF scorecards (.pdf) and CSV data tables (.csv) up to 15MB
              </p>
            </div>

            <div className="pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    void processFile(e.target.files[0]);
                  }
                }}
              />
              <Button
                type="button"
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
                isLoading={isParsing}
                className="h-10 px-5 text-xs font-bold"
              >
                {isParsing ? 'Processing Scorecard…' : 'Browse Computer'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-fg mb-1.5 block font-sans text-xs font-semibold">
              Paste CricHeroes Match Text / WhatsApp Scorecard:
            </label>
            <Textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste raw CricHeroes scorecard or summary text here...&#10;&#10;Example:&#10;Match: Strikers vs Royals&#10;Score: Strikers 185/6 (20.0)&#10;Batting: John Doe c Smith b Khan 45 (28b 5x4 2x6)&#10;Bowling: Mark Khan 4.0-0-28-3"
              className="font-mono text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              className="h-9 px-4 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handlePasteSubmit}
              disabled={!pastedText.trim()}
              className="h-9 px-5 text-xs font-bold"
            >
              Parse Scorecard
            </Button>
          </div>
        </div>
      )}

      {mode === 'file' && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="text-fg-muted hover:text-fg text-xs"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
