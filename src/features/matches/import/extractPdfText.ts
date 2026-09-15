import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  } catch {
    // Ignore worker setup error in non-standard environments
  }
}

type TextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Extracts structured plain text from a CricHeroes scorecard PDF.
 *
 * Uses pdfjs-dist to parse page text streams, grouping text fragments by vertical
 * position (y-axis) with tolerance and sorting horizontally (x-axis) so tabular
 * scorecard rows (Batting, Bowling, Scores) are preserved in natural reading order.
 */
export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  // Plain text files have no %PDF header; read them as text directly.
  const head = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 1024));
  if (!head.includes('%PDF')) {
    return new TextDecoder('utf-8').decode(buffer);
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
  });

  try {
    const pdf = await loadingTask.promise;
    const pagesText: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const items: TextItem[] = [];
      for (const item of content.items) {
        if ('str' in item && typeof item.str === 'string' && item.str.trim().length > 0) {
          const transform = (item as { transform?: number[] }).transform ?? [1, 0, 0, 1, 0, 0];
          const x = transform[4] ?? 0;
          const y = transform[5] ?? 0;
          const width = (item as { width?: number }).width ?? 0;
          const height = (item as { height?: number }).height ?? (transform[0] || 10);
          items.push({ str: item.str, x, y, width, height });
        }
      }

      if (items.length === 0) continue;

      // Group items into lines based on Y coordinate with tolerance
      const ROW_TOLERANCE = 7.0; // Y distance within which items belong to same line (table rows pitch is ~18-25pt)
      const rows: TextItem[][] = [];

      // Sort items by Y descending (top of page to bottom)
      items.sort((a, b) => b.y - a.y || a.x - b.x);

      for (const item of items) {
        let placed = false;
        for (const row of rows) {
          const avgY = row.reduce((sum, it) => sum + it.y, 0) / row.length;
          if (Math.abs(item.y - avgY) <= ROW_TOLERANCE) {
            row.push(item);
            placed = true;
            break;
          }
        }
        if (!placed) {
          rows.push([item]);
        }
      }

      // Sort rows by average Y descending (top to bottom)
      rows.sort((r1, r2) => {
        const avgY1 = r1.reduce((s, it) => s + it.y, 0) / r1.length;
        const avgY2 = r2.reduce((s, it) => s + it.y, 0) / r2.length;
        return avgY2 - avgY1;
      });

      // Within each row, sort items by X ascending (left to right) and join
      const pageLines = rows.map((row) => {
        row.sort((a, b) => a.x - b.x);
        return row
          .map((it) => it.str.trim())
          .filter(Boolean)
          .join(' ');
      });

      pagesText.push(pageLines.join('\n'));
    }

    await loadingTask.destroy();
    return pagesText.join('\n\n').trim();
  } catch (err) {
    try {
      await loadingTask.destroy();
    } catch {
      // already destroyed
    }
    throw new Error(`Unable to read PDF: ${err instanceof Error ? err.message : String(err)}`);
  }
}
