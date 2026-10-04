import { describe, expect, it } from 'vitest';
import {
  formatProjectDuration,
  projectPlanError,
  todayIsoDate,
  validProjectPlan,
} from './projectSchedule';

describe('project planning', () => {
  it('uses the local calendar date near midnight, not the UTC date', () => {
    const localLateNight = new Date(2026, 9, 4, 23, 59);
    const localEarlyMorning = new Date(2026, 9, 4, 0, 1);
    expect(todayIsoDate(localLateNight)).toBe('2026-10-04');
    expect(todayIsoDate(localEarlyMorning)).toBe('2026-10-04');
  });
  it('keeps template suggestions separate from execution dates', () => {
    expect(formatProjectDuration('template', '3 a 5 semanas', {})).toBe('');
    expect(formatProjectDuration('project', '3 a 5 semanas', {})).toBe('');
    expect(
      formatProjectDuration('project', '3 a 5 semanas', {
        plannedStartDate: '2026-09-26',
        plannedEndDate: '2026-10-24',
      }),
    ).toContain('→');
  });
  it('rejects an end before the start', () => {
    expect(
      validProjectPlan({
        plannedStartDate: '2026-10-24',
        plannedEndDate: '2026-09-26',
      }),
    ).toBe(false);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(validProjectPlan({ plannedStartDate: tomorrow.toISOString().slice(0, 10) })).toBe(true);
  });
  it('rejects starts in the past with a domain message', () => {
    const plannedStartDate = todayIsoDate(new Date(Date.now() - 48 * 60 * 60 * 1000));
    expect(validProjectPlan({ plannedStartDate })).toBe(false);
    expect(projectPlanError({ plannedStartDate })).toBe('Escolha uma data de início válida.');
  });
});
