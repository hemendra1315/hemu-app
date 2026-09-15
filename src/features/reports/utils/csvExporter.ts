/**
 * Utility for generating RFC-4180 compliant CSV files with Excel UTF-8 BOM.
 */

/**
 * Escapes a single CSV cell value according to RFC-4180:
 * - Wrap in quotes if it contains commas, double quotes, or newlines
 * - Double up any internal quotes (" -> "")
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts a 2D array of rows into a complete CSV string with UTF-8 BOM.
 */
export function generateCsvString(
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const csvContent = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');

  // Prefix with UTF-8 Byte Order Mark (\uFEFF) for native Excel compatibility
  return `\uFEFF${csvContent}`;
}

/**
 * Triggers a client-side download of a CSV file.
 */
export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
