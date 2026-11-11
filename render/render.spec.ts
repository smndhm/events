import { describe, expect, it } from 'vitest';
import { dayTitle, when } from './format.ts';
import { endsAt, endsOn, renderPage } from './page.ts';
import { renderRss } from './rss.ts';
import type { KnownEvent, Showing } from '../types.ts';

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

  it('marks the events first seen recently as new, with a tag', () => {
    const html = renderPage([event('old'), event('fresh', { firstSeen: '2026-11-10T09:00:00.000Z' })], SETTINGS, NOW);
    expect(html.match(/<span class="ds-c-tag">Nouveau<\/span>/g)).toHaveLength(1);
  });

  it('escapes what the sites write', () => {
    expect(renderPage([event('<script>')], SETTINGS, NOW)).not.toContain('<script>');
  });

  it('counts the events of a day, and folds each of its categories, counting its events, in their order', () => {
    const html = renderPage([event('film', { category: 'cinema', start: '2026-11-15T20:30:00+01:00' }), event('a'), event('b')], SETTINGS, NOW);
    const brocante = html.indexOf('<details class="day__category" data-category="brocante" open>');
    const cinema = html.indexOf('<details class="day__category" data-category="cinema" open>');
    expect(brocante).toBeGreaterThan(-1);
    expect(cinema).toBeGreaterThan(brocante);
    expect(html).toContain('<summary><strong>Brocantes et vide-greniers</strong> <small class="ds-u-text-muted">(<span class="day__count">2</span>)</small></summary>');
    expect(html).toContain('<summary><strong>Films en VO ou en français</strong> <small class="ds-u-text-muted">(<span class="day__count">1</span>)</small></summary>');
    expect(html).toContain('<span class="day__title">Dimanche 15 novembre</span> <small class="ds-u-text-muted">(<span class="day__total">3</span>)</small></h2>');
    expect(html).not.toContain('<fieldset');
    expect(html).toContain('href="rss/cinema.xml"');
  });

  it('opens every category, to be folded when it is not of interest', () => {
    const html = renderPage([event('today', { start: '2026-11-11T20:00:00+01:00', end: '2026-11-11T22:00:00+01:00' }), event('sunday', { category: 'cinema' })], SETTINGS, NOW);
    expect(html.match(/<details class="day__category" data-category="[a-z]+" open>/g)).toHaveLength(2);
  });

  it('lists an event on several days under each of them, up to the horizon, ending at midnight but on its last', () => {
    const html = renderPage([event('festival', { start: '2026-11-09T10:00:00+01:00', end: '2026-11-13T18:00:00+01:00' })], SETTINGS, NOW);
    const days = html.split('<section class="day"').slice(1);
    expect(days.map(day => day.match(/data-day="([^"]+)"/)?.[1])).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
    expect(days.map(day => day.match(/data-ends="([^"]+)"/)?.[1])).toEqual(['2026-11-12T00:00:00+01:00', '2026-11-13T00:00:00+01:00', '2026-11-13T18:00:00+01:00']);
    expect(renderPage([event('season', { start: '2026-11-11', end: '2027-03-01' })], { ...SETTINGS, horizonDays: 2 }, NOW).match(/<section class="day"/g)).toHaveLength(3);
  });

  it('lists a film under each day it is shown, with the showtimes of that day only', () => {
    const html = renderPage(
      [event('film', { category: 'cinema', start: '2026-11-11T15:45:00+01:00', place: 'Ti Hanok (Auray), CGR Lanester', showings: SHOWINGS })],
      SETTINGS,
      NOW,
    );
    const [today = '', tomorrow = ''] = html.split('<section class="day"').slice(1);
    expect(today).toContain("Aujourd'hui");
    // No line of its own: its showtimes say when and where
    expect(today).not.toContain('event__meta');
    expect(today).toMatch(/>15:45<.*>18:00</);
    expect(today).not.toContain('17:25');
    expect(today).not.toContain('CGR Lanester');
    expect(tomorrow).toContain('Demain');
    expect(tomorrow.match(/class="showings__theater"/g)).toHaveLength(2);
    expect(tomorrow).toMatch(/Ti Hanok \(Auray\).*>17:25<[\s\S]*CGR Lanester.*>20:30</);
    expect(tomorrow).not.toContain('15:45');
  });

  it('gives a cinema a line, with its showtimes of the day on Allociné, its distance and its times', () => {
    const html = renderPage([event('film', { category: 'cinema', showings: SHOWINGS })], SETTINGS, NOW);
    expect(html).toMatch(
      /<li class="showings__theater"><a href="https:\/\/example\.org\/ti-hanok#2026-11-11"><strong>Ti Hanok \(Auray\)<\/strong><span class="ds-u-visually-hidden">, séances du mer\.\u00a011 sur Allociné<\/span><\/a> <span class="ds-u-text-muted">14&nbsp;km<\/span> · <span class="showings__times"><a href="ics\/[0-9a-f]{16}\.ics" data-starts="2026-11-11T15:45:00\+01:00">15:45<span class="ds-u-visually-hidden">, ajouter la séance à l&#39;agenda<\/span><\/a>, <a href="ics\/[0-9a-f]{16}\.ics" data-starts="2026-11-11T18:00:00\+01:00">18:00/,
    );
  });

  it('adds an event to the calendar with its file', () => {
    expect(renderPage([event('fair')], SETTINGS, NOW)).toMatch(
      /<p class="event__meta"><small><a href="ics\/[0-9a-f]{16}\.ics">Ajouter à l&#39;agenda<span class="ds-u-visually-hidden"> : fair<\/span><\/a><\/small><\/p>/,
    );
  });

  it('orders a day: the events already started, then those of the whole day, then by time, the nearest first', () => {
    const html = renderPage(
      [
        event('late', { start: '2026-11-15T20:00:00+01:00' }),
        event('far-morning', { start: '2026-11-15T10:00:00+01:00', distance: 20 }),
        event('near-morning', { start: '2026-11-15T10:00:00+01:00', distance: 5 }),
        event('all-day', { start: '2026-11-15', end: undefined }),
      ],
      SETTINGS,
      NOW,
    );
    const order = ['all-day', 'near-morning', 'far-morning', 'late'].map(id => html.indexOf(`>${id}<`));
    expect(order).toEqual(order.toSorted((a, b) => a - b));
  });

  it('is styled by the design system, next to it', () => {
    const html = renderPage([event('a')], SETTINGS, NOW);
    expect(html).toContain('<link rel="stylesheet" href="ds/styles.css">');
    expect(html).toContain('<li class="ds-c-card event" data-category="brocante" data-ends="2026-11-15T18:00:00+01:00">');
    expect(html).toContain('<p class="ds-u-text-muted event__meta">08:00 – 18:00 · Hennebont, 12\u00a0km</p>');
    expect(html).toContain('<script src="page.js" defer></script>');
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

describe('endsAt', () => {
  it('is the end of an event, the end of its last day on whole days, or two hours after its start without an end', () => {
    expect(endsAt(event('a'))).toBe('2026-11-15T18:00:00+01:00');
    expect(endsAt(event('a', { start: '2026-11-15', end: undefined }))).toBe('2026-11-16T00:00:00+01:00');
    expect(endsAt(event('a', { start: '2026-07-01', end: '2026-07-03' }))).toBe('2026-07-04T00:00:00+02:00');
    expect(endsAt(event('a', { end: undefined }))).toBe('2026-11-15T09:00:00.000Z');
  });

  it('is the last showtime of a film on its day', () => {
    expect(endsAt(event('film', { start: '2026-11-12T17:25:00+01:00', end: '2026-11-12T20:30:00+01:00', showings: [] }))).toBe('2026-11-12T20:30:00+01:00');
  });
});

describe('endsOn', () => {
  it('is midnight on a day before the last, the end on the last', () => {
    const festival = event('a', { start: '2026-11-11T10:00:00+01:00', end: '2026-11-13T18:00:00+01:00' });
    expect(endsOn(festival, '2026-11-11')).toBe('2026-11-12T00:00:00+01:00');
    expect(endsOn(festival, '2026-11-13')).toBe('2026-11-13T18:00:00+01:00');
  });
});
