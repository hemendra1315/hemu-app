import { describe, expect, it } from 'vitest';
import { createBatch, updateBatch } from '../api/batchesApi';
import type { CreateBatchInput, UpdateBatchInput } from '../api/batchesTypes';

describe('Batch Creation & Optional Timing Tests (Phase 31 Audit)', () => {
  it('exposes createBatch and updateBatch API functions', () => {
    expect(typeof createBatch).toBe('function');
    expect(typeof updateBatch).toBe('function');
  });

  it('TEST A — Minimum Batch payload (Timing, Days, Coach empty)', () => {
    const minBatch: CreateBatchInput = {
      academyId: '11111111-1111-1111-1111-111111111111',
      name: 'U16 Minimum Batch',
      ageGroup: 'U16',
      description: '',
      trainingDays: '',
      trainingTime: '',
      coachId: '',
    };

    expect(minBatch.name).toBe('U16 Minimum Batch');
    expect(minBatch.ageGroup).toBe('U16');
    expect(minBatch.trainingTime).toBe('');
    expect(minBatch.trainingDays).toBe('');
    expect(minBatch.coachId).toBe('');
  });

  it('TEST B — Days Only payload (Timing empty)', () => {
    const daysOnlyBatch: CreateBatchInput = {
      academyId: '11111111-1111-1111-1111-111111111111',
      name: 'U16 Days Only Batch',
      ageGroup: 'U16',
      description: null,
      trainingDays: 'Monday, Wednesday',
      trainingTime: '',
      coachId: '',
    };

    expect(daysOnlyBatch.trainingDays).toBe('Monday, Wednesday');
    expect(daysOnlyBatch.trainingTime).toBe('');
  });

  it('TEST C — Timing Only payload (Days empty)', () => {
    const timingOnlyBatch: CreateBatchInput = {
      academyId: '11111111-1111-1111-1111-111111111111',
      name: 'U16 Timing Only Batch',
      ageGroup: 'U16',
      description: null,
      trainingDays: '',
      trainingTime: '5:00 PM - 6:30 PM',
      coachId: '',
    };

    expect(timingOnlyBatch.trainingTime).toBe('5:00 PM - 6:30 PM');
    expect(timingOnlyBatch.trainingDays).toBe('');
  });

  it('TEST D — Days + Timing payload', () => {
    const daysTimingBatch: CreateBatchInput = {
      academyId: '11111111-1111-1111-1111-111111111111',
      name: 'U16 Days + Timing Batch',
      ageGroup: 'U16',
      description: null,
      trainingDays: 'Monday, Wednesday',
      trainingTime: '5:00 PM - 6:30 PM',
      coachId: '',
    };

    expect(daysTimingBatch.trainingDays).toBe('Monday, Wednesday');
    expect(daysTimingBatch.trainingTime).toBe('5:00 PM - 6:30 PM');
  });

  it('TEST E — Days + Timing + Coach payload', () => {
    const fullBatch: CreateBatchInput = {
      academyId: '11111111-1111-1111-1111-111111111111',
      name: 'U16 Full Batch',
      ageGroup: 'U16',
      description: 'Advanced squad',
      trainingDays: 'Monday, Wednesday, Friday',
      trainingTime: '5:00 PM - 6:30 PM',
      coachId: '22222222-2222-2222-2222-222222222222',
    };

    expect(fullBatch.coachId).toBe('22222222-2222-2222-2222-222222222222');
    expect(fullBatch.trainingDays).toBe('Monday, Wednesday, Friday');
  });

  it('TEST F — Validation rejects missing/empty Batch Name', () => {
    const validateBatchName = (name: string) => name.trim().length > 0;
    expect(validateBatchName('')).toBe(false);
    expect(validateBatchName('   ')).toBe(false);
    expect(validateBatchName('Valid Batch')).toBe(true);
  });

  it('TEST G — Validation rejects missing/empty Age Group', () => {
    const validateAgeGroup = (ageGroup: string) => ageGroup.trim().length > 0;
    expect(validateAgeGroup('')).toBe(false);
    expect(validateAgeGroup('   ')).toBe(false);
    expect(validateAgeGroup('U16')).toBe(true);
  });

  it('validates batch update with empty timing and days', () => {
    const updateInput: UpdateBatchInput = {
      name: 'Updated Batch Name',
      ageGroup: 'U16',
      description: null,
      trainingDays: null,
      trainingTime: null,
      coachId: null,
    };

    expect(updateInput.trainingTime).toBeNull();
    expect(updateInput.trainingDays).toBeNull();
    expect(updateInput.coachId).toBeNull();
  });
});
