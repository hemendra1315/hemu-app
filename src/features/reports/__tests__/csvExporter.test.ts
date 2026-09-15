import { describe, it, expect, vi } from 'vitest';
import { escapeCsvCell, generateCsvString, downloadCsvFile } from '../utils/csvExporter';

describe('CSV Exporter Utility', () => {
  describe('escapeCsvCell', () => {
    it('returns empty string for null and undefined', () => {
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
    });

    it('returns simple strings and numbers unchanged', () => {
      expect(escapeCsvCell('Rohit Sharma')).toBe('Rohit Sharma');
      expect(escapeCsvCell(185)).toBe('185');
      expect(escapeCsvCell(true)).toBe('true');
    });

    it('escapes cells containing commas with double quotes', () => {
      expect(escapeCsvCell('Sharma, Rohit')).toBe('"Sharma, Rohit"');
    });

    it('escapes cells containing double quotes by doubling them', () => {
      expect(escapeCsvCell('The "Hitman"')).toBe('"The ""Hitman"""');
    });

    it('escapes cells containing newlines', () => {
      expect(escapeCsvCell('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    });
  });

  describe('generateCsvString', () => {
    it('prepends UTF-8 Byte Order Mark (\\uFEFF) and formats rows with CRLF', () => {
      const rows = [
        ['Name', 'Runs', 'Wickets'],
        ['Rohit Sharma', 64, 0],
        ['Jasprit Bumrah', 5, 3],
      ];

      const csv = generateCsvString(rows);

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('Name,Runs,Wickets\r\nRohit Sharma,64,0\r\nJasprit Bumrah,5,3');
    });

    it('handles quotes and commas across rows', () => {
      const rows = [
        ['Match', 'Winner'],
        ['Finals: Team A vs Team B', 'Team A, "Strikers"'],
      ];

      const csv = generateCsvString(rows);
      expect(csv).toContain('Finals: Team A vs Team B,"Team A, ""Strikers"""');
    });
  });

  describe('downloadCsvFile', () => {
    it('creates blob and triggers anchor click in DOM', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
      const revokeObjectURLMock = vi.fn();
      globalThis.URL.createObjectURL = createObjectURLMock;
      globalThis.URL.revokeObjectURL = revokeObjectURLMock;

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      downloadCsvFile('sample_report', '\uFEFFheader1,header2');

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');

      clickSpy.mockRestore();
    });
  });
});
