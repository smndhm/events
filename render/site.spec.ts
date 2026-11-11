import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeSite } from './site.ts';

describe('writeSite', () => {
  it('writes the page, a feed per category, and the design system next to them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'events-site-'));
    writeSite(dir, [], { home: { name: 'Landévant' }, radiusKm: 25, horizonDays: 45, newDays: 2, sources: [], siteUrl: 'https://example.org/' }, new Date('2026-11-11T09:00:00Z'));
    expect(readFileSync(join(dir, 'index.html'), 'utf8')).toContain('Rien de prévu');
    expect(existsSync(join(dir, 'ics'))).toBe(false);
    for (const file of ['rss.xml', 'rss/brocante.xml', 'rss/cinema.xml', 'rss/sortie.xml', 'page.css', 'ds/styles.css', 'ds/fonts/bricolage-grotesque-latin-wght-normal.woff2']) {
      expect(existsSync(join(dir, file)), file).toBe(true);
    }
  });
});

describe('writeSite, with events', () => {
  it('writes a calendar file per event, and per showtime of a film', () => {
    const dir = mkdtempSync(join(tmpdir(), 'events-site-'));
    const base = { source: 's', title: 'A', start: '2026-11-15', place: 'Auray', url: 'https://example.org/', firstSeen: '2026-11-11T09:00:00.000Z' };
    const showing = {
      place: 'CGR Lanester',
      url: 'https://example.org/cgr',
      days: [{ day: '2026-11-12', url: 'https://example.org/cgr#d', times: ['2026-11-12T18:00:00+01:00', '2026-11-12T20:30:00+01:00'] }],
    };
    writeSite(
      dir,
      [
        { ...base, id: 'fair', category: 'brocante' },
        { ...base, id: 'film', category: 'cinema', showings: [showing] },
      ],
      { home: { name: 'Landévant' }, radiusKm: 25, horizonDays: 45, newDays: 2, sources: [], siteUrl: 'https://example.org/' },
      new Date('2026-11-11T09:00:00Z'),
    );
    expect(readdirSync(join(dir, 'ics'))).toHaveLength(3);
  });
});
