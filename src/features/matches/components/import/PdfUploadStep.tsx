import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { extractPdfText } from '../../import/extractPdfText';

export function PdfUploadStep({
  onFileLoaded,
  onCancel,
}: {
  onFileLoaded: (text: string, filename: string) => void;
  onCancel: () => void;
}) {
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid CricHeroes PDF file (.pdf)');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('File size exceeds maximum limit of 15MB');
      return;
    }

    setError(null);
    setIsParsing(true);

    try {
      // Extract text from the PDF (decodes binary PDF streams via pdf.js).
      const result = await extractPdfText(file);
      setIsParsing(false);
      if (!result || result.trim().length === 0) {
        setError(
          "We couldn't identify a CricHeroes scorecard in this PDF. Please export the match scorecard from CricHeroes and try again.",
        );
        return;
      }
      onFileLoaded(result, file.name);
    } catch {
      setIsParsing(false);
      setError('Failed to process PDF. Please check the file and try again.');
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void processFile(e.dataTransfer.files[0]);
    }
  }

  return (
    <div className="space-y-6 text-center">
      <div>
        <h3 className="text-fg text-lg font-semibold">Upload CricHeroes PDF Scorecard</h3>
        <p className="text-fg-muted text-sm">
          Select or drag and drop a CricHeroes exported match PDF.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-8 transition-colors ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border-subtle hover:border-primary/50'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold">
            📄
          </div>
          <div>
            <p className="text-fg font-medium">Drag & drop your match PDF here</p>
            <p className="text-fg-muted text-xs">or click to browse files (max 15MB)</p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  void processFile(e.target.files[0]);
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={isParsing}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose PDF File
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-danger-500/10 border-danger-500/30 text-danger-500 rounded-xl border p-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
