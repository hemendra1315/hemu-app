import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button, Input, Select } from '@/components/ui';
import {
  MATCH_FORMAT_LABELS,
  MATCH_FORMATS,
  MATCH_RESULT_LABELS,
  MATCH_RESULTS,
  MATCH_TYPE_LABELS,
  MATCH_TYPES,
} from '@/types/enums';
import type { WizardState } from '../types';

const schema = z.object({
  matchName: z.string().min(1, 'Match name is required'),
  matchDate: z.string().min(1, 'Date is required'),
  opponentName: z.string().min(1, 'Opponent is required'),
  matchType: z.enum(MATCH_TYPES),
  format: z.enum(MATCH_FORMATS),
  result: z.enum(MATCH_RESULTS),
  venue: z.string().optional(),
  tournament: z.string().optional(),
  teamScore: z.string().optional(),
  overs: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function MatchDetailsStep({
  state,
  onChange,
  onNext,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      matchName: state.matchName,
      matchDate: state.matchDate,
      opponentName: state.opponentName,
      matchType: state.matchType,
      format: state.format,
      result: state.result,
      venue: state.venue,
      tournament: state.tournament,
      teamScore: state.teamScore,
      overs: state.overs,
    },
  });

  useEffect(() => {
    reset({
      matchName: state.matchName,
      matchDate: state.matchDate,
      opponentName: state.opponentName,
      matchType: state.matchType,
      format: state.format,
      result: state.result,
      venue: state.venue,
      tournament: state.tournament,
      teamScore: state.teamScore,
      overs: state.overs,
    });
    // only on mount — re-syncing causes focus loss on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset]);

  const onSubmit = handleSubmit((values) => {
    onChange({
      matchName: values.matchName,
      matchDate: values.matchDate,
      opponentName: values.opponentName,
      matchType: values.matchType,
      format: values.format,
      result: values.result,
      venue: values.venue ?? '',
      tournament: values.tournament ?? '',
      teamScore: values.teamScore ?? '',
      overs: values.overs ?? '',
    });
    onNext();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="matchName" className="text-fg mb-1 block text-sm font-medium">
            Match name <span className="text-danger-500">*</span>
          </label>
          <Input id="matchName" {...register('matchName')} />
          {errors.matchName && (
            <p className="text-danger-500 mt-1 text-xs" role="alert">
              {errors.matchName.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="matchDate" className="text-fg mb-1 block text-sm font-medium">
            Date <span className="text-danger-500">*</span>
          </label>
          <Input id="matchDate" type="date" {...register('matchDate')} />
          {errors.matchDate && (
            <p className="text-danger-500 mt-1 text-xs" role="alert">
              {errors.matchDate.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="opponentName" className="text-fg mb-1 block text-sm font-medium">
            Opponent <span className="text-danger-500">*</span>
          </label>
          <Input id="opponentName" {...register('opponentName')} />
          {errors.opponentName && (
            <p className="text-danger-500 mt-1 text-xs" role="alert">
              {errors.opponentName.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="venue" className="text-fg mb-1 block text-sm font-medium">
            Venue <span className="text-fg-muted text-xs font-normal">(optional)</span>
          </label>
          <Input id="venue" {...register('venue')} placeholder="e.g. City Cricket Ground" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="matchType" className="text-fg mb-1 block text-sm font-medium">
            Match type <span className="text-danger-500">*</span>
          </label>
          <Select id="matchType" {...register('matchType')}>
            {MATCH_TYPES.map((t) => (
              <option key={t} value={t}>
                {MATCH_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="format" className="text-fg mb-1 block text-sm font-medium">
            Format <span className="text-danger-500">*</span>
          </label>
          <Select id="format" {...register('format')}>
            {MATCH_FORMATS.map((f) => (
              <option key={f} value={f}>
                {MATCH_FORMAT_LABELS[f]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="result" className="text-fg mb-1 block text-sm font-medium">
            Result <span className="text-danger-500">*</span>
          </label>
          <Select id="result" {...register('result')}>
            {MATCH_RESULTS.map((r) => (
              <option key={r} value={r}>
                {MATCH_RESULT_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="teamScore" className="text-fg mb-1 block text-sm font-medium">
            Team score{' '}
            <span className="text-fg-muted text-xs font-normal">(optional, e.g. 185/6)</span>
          </label>
          <Input id="teamScore" {...register('teamScore')} placeholder="185/6" />
        </div>

        <div>
          <label htmlFor="overs" className="text-fg mb-1 block text-sm font-medium">
            Overs <span className="text-fg-muted text-xs font-normal">(optional)</span>
          </label>
          <Input id="overs" type="number" step="0.1" min="0" {...register('overs')} />
        </div>

        <div>
          <label htmlFor="tournament" className="text-fg mb-1 block text-sm font-medium">
            Tournament <span className="text-fg-muted text-xs font-normal">(optional)</span>
          </label>
          <Input id="tournament" {...register('tournament')} />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" id="details-next-btn">
          Next: Select Players →
        </Button>
      </div>
    </form>
  );
}
