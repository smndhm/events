import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import brocabrac, { joinDays, parsePage } from './brocabrac.ts';
import { context } from '../utils/testing.ts';
import type { Event } from '../types.ts';

// The Morbihan's first page and its last, as brocabrac.fr sent them on 11 November 2026
const FIRST_PAGE = readFileSync(new URL('../__fixtures__/brocabrac-56.html', import.meta.url), 'utf8');
const LAST_PAGE = readFileSync(new URL('../__fixtures__/brocabrac-56-last.html', import.meta.url), 'utf8');

const day = (start: string, end?: string): Event => ({
  id: 'brocabrac:https://brocabrac.fr/56/x/1-x',
  source: 'brocabrac',
  category: 'brocante',
  title: 'X',
  start,
  end,
  place: 'X',
  url: 'https://brocabrac.fr/56/x/1-x',
});

describe('parsePage', () => {
  const events = parsePage(FIRST_PAGE);

  it('reads every event of the page', () => {
    expect(events).toHaveLength(40);
  });

  it('reads an event whole', () => {
    expect(events.find(event => event.title === 'Troc et puces')).toEqual({
      id: 'brocabrac:https://brocabrac.fr/56/branderion/1410327-troc-et-puces',
      source: 'brocabrac',
      category: 'brocante',
      title: 'Troc et puces',
      start: '2026-11-15T08:00:00+01:00',
      end: '2026-11-15T18:00:00+01:00',
      place: 'Brandérion',
      address: expect.any(String),
      lat: expect.closeTo(47.8, 1),
      lon: expect.closeTo(-3.19, 1),
      url: 'https://brocabrac.fr/56/branderion/1410327-troc-et-puces',
      image: expect.stringMatching(/^https:\/\/brocabrac\.fr\/cdn\/event\/photos\/.+\.jpg$/),
    });
  });

  it('drops the end of a bare start day, which is its opening time', () => {
    const damgan = events.find(event => event.place === 'Damgan');
    expect(damgan?.start).toBe('2026-11-14');
    expect(damgan?.end).toBeUndefined();
  });
});

describe('joinDays', () => {
  it('joins the days that follow one another, and keeps days apart apart', () => {
    const joined = joinDays([
      day('2026-11-15T10:00:00+01:00', '2026-11-15T18:00:00+01:00'),
      day('2026-11-14T10:00:00+01:00', '2026-11-14T18:00:00+01:00'),
      day('2026-11-22T10:00:00+01:00', '2026-11-22T18:00:00+01:00'),
    ]);
    expect(joined.map(({ id, start, end }) => ({ id: id.split('@')[1], start, end }))).toEqual([
      { id: '2026-11-15', start: '2026-11-14T10:00:00+01:00', end: '2026-11-15T18:00:00+01:00' },
      { id: '2026-11-22', start: '2026-11-22T10:00:00+01:00', end: '2026-11-22T18:00:00+01:00' },
    ]);
  });

  it('keeps the id of an event on several days once its first days are gone', () => {
    const [fromWednesday] = joinDays([day('2026-11-11T10:00:00+01:00', '2026-11-11T18:00:00+01:00'), day('2026-11-12T10:00:00+01:00', '2026-11-12T18:00:00+01:00')]);
    const [fromThursday] = joinDays([day('2026-11-12T10:00:00+01:00', '2026-11-12T18:00:00+01:00')]);
    expect(fromWednesday?.id).toBe(fromThursday?.id);
  });

  it('makes one event of the garage sale on five days', () => {
    const hennebont = joinDays(parsePage(FIRST_PAGE)).filter(event => event.title === 'Vide-Maison' && event.place === 'Hennebont');
    expect(hennebont).toHaveLength(1);
    expect(hennebont[0]?.start.slice(0, 10)).toBe('2026-11-11');
    expect(hennebont[0]?.end?.slice(0, 10)).toBe('2026-11-15');
  });
});

const answer = (status: number, body = ''): Response => new Response(body, { status, headers: status === 302 ? { Location: '/56/' } : {} });

describe('brocabrac', () => {
  it('reads the pages of each kind until one redirects', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(answer(200, FIRST_PAGE))
      .mockResolvedValueOnce(answer(302))
      .mockResolvedValueOnce(answer(200, LAST_PAGE))
      .mockResolvedValueOnce(answer(302));
    const events = await brocabrac({ department: '56', kinds: ['vide-grenier', 'brocante'] }).fetchEvents(context());
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://brocabrac.fr/56/vide-grenier/',
      'https://brocabrac.fr/56/vide-grenier/?p=2',
      'https://brocabrac.fr/56/brocante/',
      'https://brocabrac.fr/56/brocante/?p=2',
    ]);
    expect(events.length).toBeGreaterThan(30);
  });

  it('joins an event listed under two kinds', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(answer(200, LAST_PAGE))
      .mockResolvedValueOnce(answer(302))
      .mockResolvedValueOnce(answer(200, LAST_PAGE))
      .mockResolvedValueOnce(answer(302));
    const twice = await brocabrac({ department: '56', kinds: ['vide-grenier', 'brocante'] }).fetchEvents(context());
    expect(new Set(twice.map(({ id }) => id)).size).toBe(twice.length);
    expect(twice).toEqual(joinDays(parsePage(LAST_PAGE)));
  });

  it('fails when a page fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(answer(503));
    await expect(brocabrac({ department: '56', kinds: ['vide-grenier'] }).fetchEvents(context())).rejects.toThrow('https://brocabrac.fr/56/vide-grenier/ answered 503');
  });
});
