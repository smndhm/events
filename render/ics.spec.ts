import { describe, expect, it } from 'vitest';
import { eventCalendar, icsPath, renderIcs, screeningCalendar, screeningKey } from './ics.ts';
import type { KnownEvent, Showing } from '../types.ts';

const NOW = new Date('2026-11-11T09:00:00Z');

const event = (fields: Partial<KnownEvent> = {}): KnownEvent => ({
  id: 'brocabrac:https://brocabrac.fr/56/x/1-x@2026-11-15',
  source: 'brocabrac',
  category: 'brocante',
  title: 'Vide grenier, troc; et puces',
  start: '2026-11-15T08:00:00+01:00',
  end: '2026-11-15T18:00:00+01:00',
  place: 'Hennebont',
  address: '2 rue du Port',
  url: 'https://brocabrac.fr/56/x/1-x',
  firstSeen: NOW.toISOString(),
  ...fields,
});

const lines = (ics: string): string[] => ics.split('\r\n');

describe('renderIcs', () => {
  it('writes an event in UTC, its text escaped, its lines ending with CRLF', () => {
    const ics = renderIcs(eventCalendar(event()), NOW);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(lines(ics)).toEqual(
      expect.arrayContaining([
        'BEGIN:VEVENT',
        'DTSTAMP:20261111T090000Z',
        'DTSTART:20261115T070000Z',
        'DTEND:20261115T170000Z',
        'SUMMARY:Vide grenier\\, troc\\; et puces',
        'LOCATION:2 rue du Port\\, Hennebont',
        'URL:https://brocabrac.fr/56/x/1-x',
      ]),
    );
  });

  it('writes an event on whole days, its end the day after its last', () => {
    expect(lines(renderIcs(eventCalendar(event({ start: '2026-12-19', end: undefined })), NOW))).toEqual(
      expect.arrayContaining(['DTSTART;VALUE=DATE:20261219', 'DTEND;VALUE=DATE:20261220']),
    );
    expect(lines(renderIcs(eventCalendar(event({ start: '2026-12-19', end: '2026-12-21' })), NOW))).toEqual(
      expect.arrayContaining(['DTSTART;VALUE=DATE:20261219', 'DTEND;VALUE=DATE:20261222']),
    );
  });

  it('gives two hours to an event at a time without an end', () => {
    expect(lines(renderIcs(eventCalendar(event({ end: undefined })), NOW))).toEqual(expect.arrayContaining(['DTSTART:20261115T070000Z', 'DTEND:20261115T090000Z']));
  });

  it('folds a line longer than 75 octets, without cutting a character', () => {
    const ics = renderIcs(eventCalendar(event({ title: 'É'.repeat(60) })), NOW);
    const summary = ics.slice(ics.indexOf('SUMMARY:'), ics.indexOf('\r\nLOCATION'));
    expect(summary.split('\r\n').every(line => Buffer.byteLength(line) <= 75)).toBe(true);
    expect(summary.replace(/\r\n /g, '')).toBe(`SUMMARY:${'É'.repeat(60)}`);
  });
});

describe('screeningCalendar', () => {
  const showing: Showing = { place: 'CGR Lanester', address: 'Rue Gustave Zédé, Lanester', url: 'https://example.org/cgr', days: [] };

  it('lasts as long as the film, at the cinema', () => {
    const film = event({ id: 'allocine:1', category: 'cinema', title: 'Hope (VO)', minutes: 93 });
    expect(lines(renderIcs(screeningCalendar(film, showing, '2026-11-12T20:30:00+01:00'), NOW))).toEqual(
      expect.arrayContaining(['DTSTART:20261112T193000Z', 'DTEND:20261112T210300Z', 'LOCATION:CGR Lanester\\, Rue Gustave Zédé\\, Lanester']),
    );
  });

  it('has a file and an id of its own for each showtime', () => {
    const film = event({ id: 'allocine:1' });
    const paths = ['2026-11-12T20:30:00+01:00', '2026-11-12T22:30:00+01:00'].map(at => icsPath(screeningKey(film, showing, at)));
    expect(new Set(paths).size).toBe(2);
    expect(paths[0]).toMatch(/^ics\/[0-9a-f]{16}\.ics$/);
  });
});
