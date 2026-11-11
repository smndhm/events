import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import morbihan, { parseEventPage, readAgendaPages, readSitemapIndex } from './morbihan.ts';
import { context } from '../utils/testing.ts';
import type { CacheStore } from '../utils/cache.ts';

// As morbihan.com sent them on 11 November 2026
const fixture = (name: string): string => readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), 'utf8');
const INDEX = fixture('morbihan-sitemap.xml');
const SITEMAP = fixture('morbihan-sitemap-10.xml');
const TREASURE_HUNT = fixture('morbihan-chasse-au-tresor-de-noel-landevant.html');
const MARKET = fixture('morbihan-marche-hebdomadaire-a-landevant.html');
const TREASURE_HUNT_URL = 'https://morbihan.com/a-voir-a-faire/agenda/tout-lagenda/chasse-au-tresor-de-noel-landevant-fr-6613008/';

describe('sitemaps', () => {
  it('reads the sitemaps of the index', () => {
    expect(readSitemapIndex(INDEX)).toHaveLength(10);
  });

  it('keeps the agenda pages of a sitemap, with the date they last changed', () => {
    const pages = readAgendaPages(SITEMAP);
    expect(pages).toHaveLength(63);
    expect(pages).toContainEqual({ url: TREASURE_HUNT_URL, lastmod: '2026-11-08T07:30:09+00:00' });
  });
});

describe('parseEventPage', () => {
  it('reads the event of a page', () => {
    expect(parseEventPage(TREASURE_HUNT, TREASURE_HUNT_URL)).toEqual([
      {
        id: `morbihan:${TREASURE_HUNT_URL}`,
        source: 'morbihan',
        category: 'sortie',
        title: 'Chasse au trésor de Noël',
        start: '2026-12-19',
        end: undefined,
        place: 'Landévant',
        address: undefined,
        lat: 47.76341,
        lon: -3.12016,
        url: TREASURE_HUNT_URL,
        image: expect.stringContaining('tourinsoft'),
      },
    ]);
  });

  it('leaves out what runs for months, such as a weekly market', () => {
    expect(parseEventPage(MARKET, 'https://morbihan.com/x/')).toEqual([]);
  });
});

// The other event pages answer `otherPages`
const answers = (otherPages = 404): void => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = String(input);
    if (url === 'https://morbihan.com/sitemap.xml/') return new Response(INDEX);
    if (url === 'https://morbihan.com/sitemap-10.xml/') return new Response(SITEMAP);
    if (url.startsWith('https://morbihan.com/sitemap-')) return new Response('<urlset></urlset>');
    if (url === TREASURE_HUNT_URL) return new Response(TREASURE_HUNT);
    return new Response('', { status: otherPages });
  });
};

describe('morbihan', () => {
  it('reads the pages not in the cache, and leaves out those that fail', async () => {
    answers();
    const events = await morbihan().fetchEvents(context());
    expect(events.map(({ title }) => title)).toEqual(['Chasse au trésor de Noël']);
  });

  it('takes from the cache the pages that did not change', async () => {
    answers(200);
    const cached = { id: 'cached', source: 'morbihan', category: 'sortie' as const, title: 'Cached', start: '2026-12-19', place: 'Landévant', url: TREASURE_HUNT_URL };
    const store: CacheStore = { test: { [TREASURE_HUNT_URL]: { version: '2026-11-08T07:30:09+00:00', events: [cached] } } };
    const events = await morbihan().fetchEvents(context(undefined, store));
    expect(events.map(({ title }) => title)).toEqual(['Cached']);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).not.toContain(TREASURE_HUNT_URL);
  });

  it('fails when no page can be read', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input =>
      String(input).includes('sitemap') ? new Response(String(input).endsWith('sitemap.xml/') ? INDEX : SITEMAP) : new Response('', { status: 503 }),
    );
    await expect(morbihan().fetchEvents(context())).rejects.toThrow('None of the');
  });
});
