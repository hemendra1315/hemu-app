import DatePicker from 'react-datepicker';
import { isTimeRangeValid } from '@/lib/utils/date';

type TimeRangePickerProps = {
  label: string;
  startTime: Date | null;
  endTime: Date | null;
  onStartTimeChange: (date: Date | null) => void;
  onEndTimeChange: (date: Date | null) => void;
};

/**
 * Shared time-range picker used by both the Create Batch and Create Session
 * forms so the time-selection UI is pixel-identical everywhere:
 *  - two react-datepicker time-only inputs in a 2-col grid
 *  - 30-minute intervals
 *  - 12-hour format with AM/PM ("h:mm aa")
 * Each start/end value remains independently selectable.
 */
export function TimeRangePicker({
  label,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
}: TimeRangePickerProps) {
  const invalid = !isTimeRangeValid(startTime, endTime);
  return (
    <div>
      <label className="font-heading text-fg-muted mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <DatePicker
          selected={startTime}
          onChange={(date: Date | null) => onStartTimeChange(date)}
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={30}
          dateFormat="h:mm aa"
          placeholderText="Start Time"
          className={`h-11 min-h-[44px] w-full rounded-lg border px-3 py-2 font-mono ${
            invalid
              ? 'border-error focus:border-error text-error'
              : 'border-border-subtle bg-surface text-fg'
          }`}
          popperClassName="react-datepicker-popper"
          autoComplete="off"
        />
        <DatePicker
          selected={endTime}
          onChange={(date: Date | null) => onEndTimeChange(date)}
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={30}
          dateFormat="h:mm aa"
          placeholderText="End Time"
          className={`h-11 min-h-[44px] w-full rounded-lg border px-3 py-2 font-mono ${
            invalid
              ? 'border-error focus:border-error text-error'
              : 'border-border-subtle bg-surface text-fg'
          }`}
          popperClassName="react-datepicker-popper"
          autoComplete="off"
        />
      </div>
      {invalid && (
        <p className="text-error mt-1 font-sans text-[11px] font-semibold">
          End time must be after start time.
        </p>
      )}
    </div>
  );
}
