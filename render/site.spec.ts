import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeSite } from './site.ts';

describe('writeSite', () => {
  it('writes the page, a feed per category, and the design system next to them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'events-site-'));
    writeSite(dir, [], { home: { name: 'Landévant' }, radiusKm: 25, horizonDays: 45, newDays: 2, sources: [], siteUrl: 'https://example.org/' }, new Date('2026-11-11T09:00:00Z'));
    expect(readFileSync(join(dir, 'index.html'), 'utf8')).toContain('Rien de prévu');
    for (const file of ['rss.xml', 'rss/brocante.xml', 'rss/cinema.xml', 'rss/sortie.xml', 'ds/styles.css', 'ds/fonts/bricolage-grotesque-latin-wght-normal.woff2']) {
      expect(existsSync(join(dir, file)), file).toBe(true);
    }
  });
});
