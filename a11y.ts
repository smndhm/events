// pnpm test:a11y: renders the page from the Brocabrac page of __fixtures__, plus a film so it has two categories and its
// filter, then runs axe on it (@dume/dev-config/a11y) in light and dark, and checks the filter hides what it leaves out.
// Needs Playwright's Chromium (pnpm exec playwright install chromium), or another one at CHROMIUM_PATH.
import { readFileSync } from 'node:fs';
import { audit } from '@dume/dev-config/a11y';
import { chromium } from 'playwright';
import { renderPage } from './render/page.ts';
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
const html = renderPage(
  events,
  { home: { name: 'Landévant' }, radiusKm: 25, horizonDays: 45, newDays: 2, sources: [{ label: 'Brocabrac', homepage: 'https://brocabrac.fr/56/' }] },
  NOW,
);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const failures: string[] = [];
try {
  for (const colorScheme of ['light', 'dark'] as const) {
    const page = await browser.newPage({ colorScheme });
    await page.setContent(html);
    failures.push(...(await audit(page)).map(violation => `${colorScheme}: ${violation}`));

    await page.getByLabel('Films en VO').check();
    const visible = await page.locator('li:visible').count();
    if (visible !== 1) failures.push(`${colorScheme}: the film filter shows ${visible} events, not 1`);
    await page.close();
  }
} finally {
  await browser.close();
}

failures.forEach(failure => console.error(failure));
console.log(failures.length ? `${failures.length} problems` : 'No accessibility violation, and the filter works');
process.exitCode = failures.length ? 1 : 0;
