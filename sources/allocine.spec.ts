import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import allocine, { describeShowtimes, parseShowtimes, toEvents, type Theater } from './allocine.ts';
import { context } from '../utils/testing.ts';

// CGR Lanester's showtimes of 12 November 2026, its two pages, as Allociné sent them on 11 November
const PAGE_1 = readFileSync(new URL('../__fixtures__/allocine-P9556-2026-11-12.json', import.meta.url), 'utf8');
const PAGE_2 = readFileSync(new URL('../__fixtures__/allocine-P9556-2026-11-12-p2.json', import.meta.url), 'utf8');

const THEATER: Theater = { id: 'P9556', name: 'CGR Lanester', address: 'Rue Gustave Zédé', place: 'Lanester', lat: 47.775337, lon: -3.355623 };

describe('parseShowtimes', () => {
  it('keeps the showtimes in original version, in Paris time', () => {
    const screenings = parseShowtimes(JSON.parse(PAGE_1));
    expect(screenings).toContainEqual({ movieId: expect.any(Number), title: 'Godzilla Minus Zero', startsAt: expect.stringMatching(/^2026-11-12T\d{2}:\d{2}:00\+01:00$/) });
    // French films and dubbed showtimes are not in original version
    expect(screenings.map(({ title }) => title)).not.toContain('Gilles United');
    expect(screenings.every(({ startsAt }) => startsAt.endsWith('+01:00'))).toBe(true);
  });

  it('fails on an error', () => {
    expect(() => parseShowtimes({ error: true, message: 'nope', results: [] })).toThrow('nope');
  });
});

describe('toEvents', () => {
  it('makes one event per film, from its first showtime to its last', () => {
    const [event] = toEvents(THEATER, [
      { movieId: 1, title: 'Hope', startsAt: '2026-11-13T20:10:00+01:00' },
      { movieId: 1, title: 'Hope', startsAt: '2026-11-12T13:40:00+01:00' },
      { movieId: 1, title: 'Hope', startsAt: '2026-11-12T20:10:00+01:00' },
    ]);
    expect(event).toMatchObject({
      id: 'allocine:P9556:1',
      category: 'cinema',
      title: 'Hope (VO)',
      start: '2026-11-12T13:40:00+01:00',
      end: '2026-11-13T20:10:00+01:00',
      place: 'CGR Lanester',
      url: 'https://www.allocine.fr/seance/salle_gen_csalle=P9556.html',
      details: 'jeu.\u00a012\u00a0:\u00a013:40, 20:10 · ven.\u00a013\u00a0:\u00a020:10',
    });
  });

  it('names the town of a cinema whose name does not', () => {
    const [event] = toEvents({ ...THEATER, name: 'Ti Hanok', place: 'Auray' }, [{ movieId: 1, title: 'Hope', startsAt: '2026-11-12T13:40:00+01:00' }]);
    expect(event?.place).toBe('Ti Hanok, Auray');
  });
});

describe('describeShowtimes', () => {
  it('groups the times by day, in Paris time', () => {
    expect(describeShowtimes(['2026-07-01T22:30:00+02:00', '2026-07-01T14:00:00+02:00'])).toBe('mer.\u00a01\u00a0:\u00a014:00, 22:30');
  });
});

describe('allocine', () => {
  it('reads every page of every day', async () => {
    const empty = JSON.stringify({ error: false, results: [], pagination: { page: 1, totalPages: 1 } });
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(PAGE_1)).mockResolvedValueOnce(new Response(PAGE_2)).mockResolvedValueOnce(new Response(empty));
    const events = await allocine({ theaters: [THEATER], days: 2 }).fetchEvents(context(new Date('2026-11-12T09:00:00Z')));
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://www.allocine.fr/_/showtimes/theater-P9556/d-2026-11-12/',
      'https://www.allocine.fr/_/showtimes/theater-P9556/d-2026-11-12/p-2/',
      'https://www.allocine.fr/_/showtimes/theater-P9556/d-2026-11-13/',
    ]);
    expect(events.map(({ title }) => title)).toContain('Godzilla Minus Zero (VO)');
  });
});
