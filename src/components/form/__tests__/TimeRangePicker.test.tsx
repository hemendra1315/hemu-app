import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimeRangePicker } from '../TimeRangePicker';
import { isTimeRangeValid } from '@/lib/utils/date';
import '@testing-library/jest-dom';

describe('isTimeRangeValid', () => {
  it('returns true for 8:00 AM -> 9:00 AM', () => {
    const start = new Date('2024-01-01T08:00:00');
    const end = new Date('2024-01-01T09:00:00');
    expect(isTimeRangeValid(start, end)).toBe(true);
  });
  it('returns false for 9:00 AM -> 9:00 AM', () => {
    const start = new Date('2024-01-01T09:00:00');
    const end = new Date('2024-01-01T09:00:00');
    expect(isTimeRangeValid(start, end)).toBe(false);
  });
  it('returns false for 9:00 AM -> 8:00 AM', () => {
    const start = new Date('2024-01-01T09:00:00');
    const end = new Date('2024-01-01T08:00:00');
    expect(isTimeRangeValid(start, end)).toBe(false);
  });
  it('returns true for 11:30 AM -> 12:15 PM', () => {
    const start = new Date('2024-01-01T11:30:00');
    const end = new Date('2024-01-01T12:15:00');
    expect(isTimeRangeValid(start, end)).toBe(true);
  });
});

describe('TimeRangePicker Component', () => {
  it('renders validation message when invalid and clears when corrected', () => {
    const { rerender } = render(
      <TimeRangePicker
        label="Time"
        startTime={new Date('2024-01-01T09:00:00')}
        endTime={new Date('2024-01-01T08:00:00')}
        onStartTimeChange={vi.fn()}
        onEndTimeChange={vi.fn()}
      />,
    );
    expect(screen.getByText('End time must be after start time.')).toBeInTheDocument();

    rerender(
      <TimeRangePicker
        label="Time"
        startTime={new Date('2024-01-01T08:00:00')}
        endTime={new Date('2024-01-01T09:00:00')}
        onStartTimeChange={vi.fn()}
        onEndTimeChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('End time must be after start time.')).not.toBeInTheDocument();
  });
});
