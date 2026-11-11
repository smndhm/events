import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dayTitle, when } from './format.ts';
import { renderPage } from './page.ts';
import { renderRss } from './rss.ts';
import { CATEGORIES, type KnownEvent, type Showing } from '../types.ts';

const NOW = new Date('2026-11-11T09:00:00Z');

const SHOWINGS: Showing[] = [
  {
    place: 'Ti Hanok (Auray)',
    url: 'https://example.org/ti-hanok',
    distance: 14,
    days: [
      { day: '2026-11-11', url: 'https://example.org/ti-hanok#2026-11-11', times: ['2026-11-11T15:45:00+01:00', '2026-11-11T18:00:00+01:00'] },
      { day: '2026-11-12', url: 'https://example.org/ti-hanok#2026-11-12', times: ['2026-11-12T17:25:00+01:00'] },
    ],
  },
  {
    place: 'CGR Lanester',
    url: 'https://example.org/cgr',
    distance: 18,
    days: [{ day: '2026-11-12', url: 'https://example.org/cgr#2026-11-12', times: ['2026-11-12T20:30:00+01:00'] }],
  },
];
const SETTINGS = { home: { name: 'Landévant' }, radiusKm: 25, horizonDays: 45, newDays: 2, sources: [{ label: 'Brocabrac', homepage: 'https://brocabrac.fr/56/' }] };

const event = (id: string, fields: Partial<KnownEvent> = {}): KnownEvent => ({
  id,
  source: 'test',
  category: 'brocante',
  title: id,
  start: '2026-11-15T08:00:00+01:00',
  end: '2026-11-15T18:00:00+01:00',
  place: 'Hennebont',
  url: `https://example.org/${id}`,
  distance: 12,
  firstSeen: '2026-11-01T05:00:00.000Z',
  ...fields,
});

describe('format', () => {
  it('names today and tomorrow, then the day', () => {
    expect(dayTitle('2026-11-11', '2026-11-11')).toBe("Aujourd'hui");
    expect(dayTitle('2026-11-12', '2026-11-11')).toBe('Demain');
    expect(dayTitle('2026-11-15', '2026-11-11')).toBe('Dimanche 15 novembre');
  });

  it('tells the hours in Paris, the last day of an event on several, or nothing for a bare day', () => {
    expect(when(event('a'))).toBe('08:00 – 18:00');
    expect(when(event('a', { end: '2026-11-16T18:00:00+01:00' }))).toBe("jusqu'au lun. 16 nov.");
    expect(when(event('a', { start: '2026-11-15', end: undefined }))).toBe('');
    expect(when(event('a', { showings: SHOWINGS }))).toBe('Ti Hanok (Auray) : mer.\u00a011 15:45, 18:00 · jeu.\u00a012 17:25 ; CGR Lanester : jeu.\u00a012 20:30');
  });
});

describe('renderPage', () => {
  it('lists the events by day, an ongoing one under today', () => {
    const html = renderPage([event('ongoing', { start: '2026-11-09T10:00:00+01:00' }), event('sunday')], SETTINGS, NOW);
    expect(html.indexOf("Aujourd'hui")).toBeLessThan(html.indexOf('ongoing'));
    expect(html.indexOf('Dimanche 15 novembre')).toBeLessThan(html.indexOf('>sunday<'));
  });

  it('marks the events first seen recently as new', () => {
    const html = renderPage([event('old'), event('fresh', { firstSeen: '2026-11-10T09:00:00.000Z' })], SETTINGS, NOW);
    expect(html.match(/>Nouveau</g)).toHaveLength(1);
  });

  it('escapes what the sites write', () => {
    expect(renderPage([event('<script>')], SETTINGS, NOW)).not.toContain('<script>');
  });

  it('offers a filter once there are two categories', () => {
    expect(renderPage([event('a')], SETTINGS, NOW)).not.toContain('<fieldset');
    const html = renderPage([event('a'), event('b', { category: 'cinema' })], SETTINGS, NOW);
    expect(html).toContain('id="filter-cinema"');
    expect(html).toContain('href="rss/cinema.xml"');
  });

  it('lists the cinemas of a film, each with its days and their times, and its links', () => {
    const html = renderPage([event('film', { category: 'cinema', place: 'Ti Hanok (Auray), CGR Lanester', showings: SHOWINGS })], SETTINGS, NOW);
    expect(html).toContain('<p class="ds-u-text-muted event__meta">Ciné · 2 cinémas</p>');
    expect(html).toContain(
      '<p class="showings__name"><a href="https://example.org/ti-hanok">Ti Hanok (Auray)<span class="ds-u-visually-hidden">, toutes les séances</span></a> <span class="ds-u-text-muted">· 14&nbsp;km</span></p>',
    );
    expect(html).toContain(
      '<dt class="showings__day"><a href="https://example.org/ti-hanok#2026-11-11">mer.\u00a011<span class="ds-u-visually-hidden">, séances du jour à Ti Hanok (Auray)</span></a></dt>',
    );
    expect(html).toMatch(
      /<dd class="showings__times"><a href="ics\/[0-9a-f]{16}\.ics">15:45<span class="ds-u-visually-hidden">, ajouter la séance à l'agenda<\/span><\/a>, <a href="ics\/[0-9a-f]{16}\.ics">18:00/,
    );
  });

  it('adds an event to the calendar with a link', () => {
    expect(renderPage([event('fair')], SETTINGS, NOW)).toMatch(
      /<p class="event__meta"><a href="ics\/[0-9a-f]{16}\.ics">Ajouter à l'agenda<span class="ds-u-visually-hidden"> : fair<\/span><\/a><\/p>/,
    );
  });

  it('is styled by the design system, next to it', () => {
    const html = renderPage([event('a')], SETTINGS, NOW);
    expect(html).toContain('<link rel="stylesheet" href="ds/styles.css">');
    expect(html).toContain('<li class="ds-c-card event" data-category="brocante">');
  });

  it('says when there is nothing', () => {
    expect(renderPage([], SETTINGS, NOW)).toContain('Rien de prévu');
  });
});

describe('renderRss', () => {
  const feed = { title: 'Autour', description: 'D', link: 'https://example.org/', self: 'https://example.org/rss.xml' };

  it('dates each item by the day it was first seen, newest first', () => {
    const xml = renderRss(feed, [event('old'), event('fresh', { firstSeen: '2026-11-10T09:00:00.000Z' })], NOW);
    expect(xml.indexOf('<guid isPermaLink="false">fresh</guid>')).toBeLessThan(xml.indexOf('<guid isPermaLink="false">old</guid>'));
    expect(xml).toContain('<pubDate>Tue, 10 Nov 2026 09:00:00 GMT</pubDate>');
    expect(xml).toContain('<title>dim. 15 nov. · fresh · Hennebont, 12 km</title>');
  });
});

describe('page.css', () => {
  it('has a filter rule for every category', () => {
    const css = readFileSync(new URL('page.css', import.meta.url), 'utf8');
    for (const category of Object.keys(CATEGORIES)) {
      expect(css).toContain(`:root:has(#filter-${category}:checked)`);
    }
  });
});
