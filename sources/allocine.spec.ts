import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import allocine, { describeShowtimes, parseShowtimes, theaterLabel, toEvents, type Screening, type Theater } from './allocine.ts';
import { context } from '../utils/testing.ts';

// CGR Lanester's showtimes of 12 November 2026, its two pages, as Allociné sent them on 11 November
const PAGE_1 = readFileSync(new URL('../__fixtures__/allocine-P9556-2026-11-12.json', import.meta.url), 'utf8');
const PAGE_2 = readFileSync(new URL('../__fixtures__/allocine-P9556-2026-11-12-p2.json', import.meta.url), 'utf8');

const CGR: Theater = { id: 'P9556', name: 'CGR Lanester', address: 'Rue Gustave Zédé', place: 'Lanester', lat: 47.775337, lon: -3.355623 };
const TI_HANOK: Theater = { id: 'P0591', name: 'Ti Hanok', address: "Place de l'Europe", place: 'Auray', lat: 47.669841, lon: -3.008386 };
const LANDEVANT = { lat: 47.77442, lon: -3.118101 };

const screening = (startsAt: string, fields: Partial<Screening> = {}): Screening => ({ movieId: 1, title: 'Hope', startsAt, version: 'ORIGINAL', ...fields });

describe('parseShowtimes', () => {
  const screenings = parseShowtimes(JSON.parse(PAGE_1));
  const titles = new Set(screenings.map(({ title }) => title));

  it('keeps the foreign films in original version and the French films, in Paris time', () => {
    expect(screenings).toContainEqual({
      movieId: expect.any(Number),
      title: 'Godzilla Minus Zero',
      startsAt: expect.stringMatching(/^2026-11-12T\d{2}:\d{2}:00\+01:00$/),
      version: 'ORIGINAL',
    });
    expect(screenings).toContainEqual(expect.objectContaining({ title: 'Gilles United', version: 'LOCAL' }));
    expect(screenings.every(({ startsAt }) => startsAt.endsWith('+01:00'))).toBe(true);
  });

  it('leaves out the dubbed showtimes', () => {
    // Shown dubbed only, that day
    expect(titles.has('Dune')).toBe(false);
    // Shown once in original version, three times dubbed
    expect(screenings.filter(({ title }) => title === 'Godzilla Minus Zero')).toHaveLength(1);
  });

  it('fails on an error', () => {
    expect(() => parseShowtimes({ error: true, message: 'nope', results: [] })).toThrow('nope');
  });
});

describe('toEvents', () => {
  it('makes one event per film, its cinemas each on a line, in the order given', () => {
    const [event] = toEvents([
      { theater: TI_HANOK, screenings: [screening('2026-11-13T20:10:00+01:00')] },
      { theater: CGR, screenings: [screening('2026-11-12T20:10:00+01:00'), screening('2026-11-12T13:40:00+01:00')] },
    ]);
    expect(event).toMatchObject({
      id: 'allocine:1',
      category: 'cinema',
      title: 'Hope (VO)',
      start: '2026-11-12T13:40:00+01:00',
      end: '2026-11-13T20:10:00+01:00',
      place: 'Ti Hanok (Auray), CGR Lanester',
      // The first cinema's, the nearest
      lat: TI_HANOK.lat,
      url: 'https://www.allocine.fr/film/fichefilm_gen_cfilm=1.html',
      details: ['Ti Hanok (Auray) : ven. 13 : 20:10', 'CGR Lanester : jeu. 12 : 13:40, 20:10'],
    });
  });

  it('says nothing of the version of a French film', () => {
    const [event] = toEvents([{ theater: CGR, screenings: [screening('2026-11-12T20:10:00+01:00', { title: 'Moulin', version: 'LOCAL' })] }]);
    expect(event?.title).toBe('Moulin');
  });

  it('keeps the films apart', () => {
    expect(toEvents([{ theater: CGR, screenings: [screening('2026-11-12T20:10:00+01:00'), screening('2026-11-12T20:10:00+01:00', { movieId: 2 })] }])).toHaveLength(2);
  });
});

describe('theaterLabel', () => {
  it('names the town of a cinema whose name does not', () => {
    expect(theaterLabel(TI_HANOK)).toBe('Ti Hanok (Auray)');
    expect(theaterLabel(CGR)).toBe('CGR Lanester');
  });
});

describe('describeShowtimes', () => {
  it('groups the times by day, in Paris time', () => {
    expect(describeShowtimes(['2026-07-01T22:30:00+02:00', '2026-07-01T14:00:00+02:00'])).toBe('mer. 1 : 14:00, 22:30');
  });
});

describe('allocine', () => {
  const empty = JSON.stringify({ error: false, results: [], pagination: { page: 1, totalPages: 1 } });

  it('reads every page of every day, of the nearest cinema first', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async input => new Response(String(input).endsWith('theater-P9556/d-2026-11-12/') ? PAGE_1 : String(input).endsWith('p-2/') ? PAGE_2 : empty));
    const events = await allocine({ home: LANDEVANT, theaters: [CGR, TI_HANOK], days: 2 }).fetchEvents(context(new Date('2026-11-12T09:00:00Z')));
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://www.allocine.fr/_/showtimes/theater-P0591/d-2026-11-12/',
      'https://www.allocine.fr/_/showtimes/theater-P0591/d-2026-11-13/',
      'https://www.allocine.fr/_/showtimes/theater-P9556/d-2026-11-12/',
      'https://www.allocine.fr/_/showtimes/theater-P9556/d-2026-11-12/p-2/',
      'https://www.allocine.fr/_/showtimes/theater-P9556/d-2026-11-13/',
    ]);
    expect(events.map(({ title }) => title)).toEqual(expect.arrayContaining(['Godzilla Minus Zero (VO)', 'Gilles United']));
  });
});
