// pnpm test:a11y: writes the site, with the design system, from the Brocabrac page of __fixtures__, plus a film so it has two categories and its
// filter, then runs axe on it (@dume/dev-config/a11y) in light and dark, and checks the filter hides what it leaves out.
// Needs Playwright's Chromium (pnpm exec playwright install chromium), or another one at CHROMIUM_PATH.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { audit } from '@dume/dev-config/a11y';
import { chromium } from 'playwright';
import { writeSite } from './render/site.ts';
import { joinDays, parsePage } from './sources/brocabrac.ts';
import type { KnownEvent } from './types.ts';

const NOW = new Date('2026-11-11T09:00:00Z');

const brocantes = joinDays(parsePage(readFileSync('__fixtures__/brocabrac-56.html', 'utf8')));
const events: KnownEvent[] = [
  ...brocantes.map((event, index) => ({ ...event, distance: index, firstSeen: index % 3 ? '2026-11-01T00:00:00.000Z' : NOW.toISOString() })),
  {
    id: 'film',
    source: 'test',
    category: 'cinema',
    title: 'Un film en VOST',
    start: '2026-11-14T20:30:00+01:00',
    place: 'Auray',
    url: 'https://example.org/film',
    distance: 9,
    firstSeen: NOW.toISOString(),
  },
];
// Written as the build writes it, with the design system's stylesheet next to the page
const dir = mkdtempSync(join(tmpdir(), 'events-a11y-'));
const settings = { home: { name: 'Landévant' }, radiusKm: 25, horizonDays: 45, newDays: 2, siteUrl: 'https://example.org/' };
writeSite(dir, events, { ...settings, sources: [{ label: 'Brocabrac', homepage: 'https://brocabrac.fr/56/' }] }, NOW);
const url = pathToFileURL(join(dir, 'index.html')).href;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const failures: string[] = [];
try {
  for (const colorScheme of ['light', 'dark'] as const) {
    const page = await browser.newPage({ colorScheme });
    await page.goto(url);
    failures.push(...(await audit(page)).map(violation => `${colorScheme}: ${violation}`));

    await page.getByLabel('Films en VO').check();
    const visible = await page.locator('.event:visible').count();
    if (visible !== 1) failures.push(`${colorScheme}: the film filter shows ${visible} events, not 1`);
    await page.close();
  }
} finally {
  await browser.close();
}

failures.forEach(failure => console.error(failure));
console.log(failures.length ? `${failures.length} problems` : 'No accessibility violation, and the filter works');
process.exitCode = failures.length ? 1 : 0;
