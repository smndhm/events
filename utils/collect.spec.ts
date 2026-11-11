import { describe, expect, it } from 'vitest';
import { collect } from './collect.ts';
import type { Event, KnownEvent, Source } from '../types.ts';

const NOW = new Date('2026-11-11T09:00:00Z');
const SETTINGS = { home: { lat: 47.77442, lon: -3.118101 }, radiusKm: 25, horizonDays: 45 };

const event = (id: string, fields: Partial<Event> = {}): Event => ({
  id,
  source: 'test',
  category: 'brocante',
  title: id,
  start: '2026-11-15T10:00:00+01:00',
  place: 'Hennebont',
  lat: 47.8048,
  lon: -3.2779,
  url: `https://example.org/${id}`,
  ...fields,
});

const source = (events: Event[] | Error, name = 'test'): Source => ({
  name,
  label: name,
  homepage: 'https://example.org',
  fetchEvents: async () => {
    if (events instanceof Error) throw events;
    return events;
  },
});

describe('collect', () => {
  it('measures the distance, and keeps the events within the radius and the horizon, not over yet', async () => {
    const { events } = await collect(
      [
        source([
          event('near'),
          event('far', { lat: 48.11, lon: -1.68 }),
          event('nowhere', { lat: undefined, lon: undefined }),
          event('over', { start: '2026-11-10T10:00:00+01:00' }),
          event('ongoing', { start: '2026-11-09T10:00:00+01:00', end: '2026-11-12T18:00:00+01:00' }),
          event('later', { start: '2027-03-01T10:00:00+01:00' }),
        ]),
      ],
      [],
      SETTINGS,
      {},
      NOW,
    );
    expect(events.map(({ id, distance }) => [id, distance])).toEqual([
      ['ongoing', 12],
      ['near', 12],
      ['nowhere', undefined],
    ]);
  });

  it('keeps the day an event was first seen, and dates the new ones now', async () => {
    const previous: KnownEvent[] = [{ ...event('seen'), firstSeen: '2026-11-01T05:00:00.000Z' }];
    const { events } = await collect([source([event('seen'), event('fresh')])], previous, SETTINGS, {}, NOW);
    expect(Object.fromEntries(events.map(({ id, firstSeen }) => [id, firstSeen]))).toEqual({ seen: '2026-11-01T05:00:00.000Z', fresh: NOW.toISOString() });
  });

  it('keeps the events of the last run of a source that fails, and reports it', async () => {
    const previous: KnownEvent[] = [
      { ...event('kept', { source: 'broken' }), firstSeen: '2026-11-01T05:00:00.000Z' },
      { ...event('gone'), firstSeen: '2026-11-01T05:00:00.000Z' },
    ];
    const error = new Error('down');
    const { events, reports } = await collect([source(error, 'broken'), source([event('fresh')])], previous, SETTINGS, {}, NOW);
    expect(events.map(({ id }) => id).toSorted()).toEqual(['fresh', 'kept']);
    expect(reports).toEqual([
      { name: 'broken', events: 1, error },
      { name: 'test', events: 1 },
    ]);
  });
});
