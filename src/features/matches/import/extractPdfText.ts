import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Extracts plain text from a CricHeroes scorecard PDF.
 *
 * `FileReader.readAsText()` on a binary PDF returns mojibake, so the previous
 * upload flow handed garbage to the parser. This uses pdf.js to decode the PDF
 * content streams and rebuild the page text (columns joined with whitespace,
 * lines with newlines) so the downstream text parser sees real data.
 *
 * Falls back to raw `readAsText` when the file is actually a plain text file
 * (some exports are .txt) so that path keeps working.
 */
export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  // Plain text files have no %PDF header; read them as text directly.
  const head = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 1024));
  if (!head.includes('%PDF')) {
    return head;
  }

  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  try {
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let lastY: number | null = null;
      let line = '';
      const out: string[] = [];
      for (const item of content.items) {
        if ('str' in item) {
          const y: number | null = (item as { transform?: number[] }).transform?.[5] ?? lastY;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
            out.push(line);
            line = '';
          }
          line += `${item.str} `;
          lastY = y;
        }
      }
      out.push(line);
      pages.push(out.join('\n').trim());
    }
    await loadingTask.destroy();
    return pages.join('\n\n').trim();
  } catch (err) {
    try {
      await loadingTask.destroy();
    } catch {
      // already failed
    }
    throw new Error(`Unable to read PDF: ${err instanceof Error ? err.message : String(err)}`);
  }
}
