import { describe, expect, it } from 'vitest';
import { addDays, lastDay, parisDay } from './dates.ts';

describe('parisDay', () => {
  it('tells the day in Paris, not in UTC', () => {
    expect(parisDay('2026-11-14T23:30:00Z')).toBe('2026-11-15');
    expect(parisDay(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02');
  });

  it('keeps a bare day as it is', () => {
    expect(parisDay('2026-11-14')).toBe('2026-11-14');
  });
});

describe('addDays', () => {
  it('crosses months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('lastDay', () => {
  it('is the end day, or the start day without an end or with an end before it', () => {
    expect(lastDay({ start: '2026-11-14T10:00:00+01:00', end: '2026-11-16T18:00:00+01:00' })).toBe('2026-11-16');
    expect(lastDay({ start: '2026-11-14' })).toBe('2026-11-14');
    expect(lastDay({ start: '2026-11-14', end: '2026-11-13' })).toBe('2026-11-14');
  });
});
