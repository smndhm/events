// pnpm test:a11y: writes the site, with the design system, from the Brocabrac page of __fixtures__, plus a film so it has two categories in its
// days' categories, then runs axe on it (@dume/dev-config/a11y) in light and dark, its categories open, checks their
// counts, that, read later, what has passed is hidden and the counts follow, and that only the new ones can be seen.
// Needs Playwright's Chromium (pnpm exec playwright install chromium), or another one at CHROMIUM_PATH.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { audit } from '@dume/dev-config/a11y';
import { chromium } from 'playwright';
import { writeSite } from './render/site.ts';
import { toShowing } from './sources/allocine.ts';
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
    place: 'Ti Hanok (Auray)',
    url: 'https://example.org/film',
    distance: 9,
    firstSeen: NOW.toISOString(),
    // With its cinemas, their days and their times, and their links
    showings: [
      toShowing({ id: 'P0591', name: 'Ti Hanok', address: '', place: 'Auray', lat: 47.67, lon: -3.01 }, 14, ['2026-11-14T20:30:00+01:00', '2026-11-15T16:00:00+01:00']),
      toShowing({ id: 'P9556', name: 'CGR Lanester', address: '', place: 'Lanester', lat: 47.78, lon: -3.36 }, 18, ['2026-11-14T18:00:00+01:00']),
    ],
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
    // Read when it was built, every category open, for axe to see what they fold
    const page = await browser.newPage({ colorScheme });
    await page.clock.setFixedTime(NOW);
    await page.goto(url);
    await page.evaluate(() => document.querySelectorAll('details').forEach(details => details.setAttribute('open', '')));
    failures.push(...(await audit(page)).map(violation => `${colorScheme}: ${violation}`));

    const counts = await page.evaluate(() =>
      [...document.querySelectorAll('.day__category')].map(category => [category.querySelector('.day__count')?.textContent, String(category.querySelectorAll('.event').length)]),
    );
    if (counts.some(([shown, inside]) => shown !== inside)) failures.push(`${colorScheme}: a category counts other than its events`);
    const totals = await page.evaluate(() =>
      [...document.querySelectorAll('.day')].map(day => [day.querySelector('.day__total')?.textContent, String(day.querySelectorAll('.event').length)]),
    );
    if (totals.some(([shown, inside]) => shown !== inside)) failures.push(`${colorScheme}: a day counts other than its events`);
    // The film, under each of its two days
    const films = await page.locator('.day__category[data-category="cinema"]').count();
    if (films !== 2) failures.push(`${colorScheme}: the film is in ${films} days, not its 2`);
    await page.close();
  }

  // Read on Saturday 14 November at 19:00, three days after the build: what has passed is hidden (render/page.js)
  const now = new Date('2026-11-14T19:00:00+01:00');
  const page = await browser.newPage();
  await page.clock.setFixedTime(now);
  await page.goto(url);
  const read = await page.evaluate(() => ({
    hidden: document.querySelectorAll('.event[hidden]').length,
    ends: [...document.querySelectorAll('.event:not([hidden])')].map(event => event.getAttribute('data-ends') ?? ''),
    starts: [...document.querySelectorAll('.showings__theater:not([hidden]) [data-starts]')].map(link => link.getAttribute('data-starts') ?? ''),
    counts: [...document.querySelectorAll('.day__category:not([hidden])')].map(category => [
      category.querySelector('.day__count')?.textContent,
      String(category.querySelectorAll('.event:not([hidden])').length),
    ]),
    totals: [...document.querySelectorAll('.day:not([hidden])')].map(day => [
      day.querySelector('.day__total')?.textContent,
      String(day.querySelectorAll('.event:not([hidden])').length),
    ]),
    open: [...document.querySelectorAll('.day:not([hidden])')].map(day => [day.getAttribute('data-day'), day.querySelector('.day__category')?.hasAttribute('open')]),
    headings: Object.fromEntries([...document.querySelectorAll('.day:not([hidden])')].map(day => [day.getAttribute('data-day'), day.querySelector('.day__title')?.textContent])),
  }));
  if (read.hidden === 0) failures.push('read later, no event is hidden');
  if (read.counts.some(([shown, left]) => shown !== left || left === '0')) failures.push('read later, a category counts other than its events left');
  if (read.open.some(([, open]) => !open)) failures.push(`read later, a category is folded: ${JSON.stringify(read.open)}`);
  if (read.totals.some(([shown, left]) => shown !== left || left === '0')) failures.push('read later, a day counts other than its events left');
  if (read.ends.some(ends => new Date(ends) <= now)) failures.push('read later, an event over is still shown');
  if (read.starts.some(starts => new Date(starts) <= now)) failures.push('read later, a showtime started is still shown');
  if (!read.starts.includes('2026-11-14T20:30:00+01:00')) failures.push("read later, the evening's showtime is gone");
  if (read.headings['2026-11-14'] !== "Aujourd'hui" || read.headings['2026-11-15'] !== 'Demain')
    failures.push(`read later, the days are misnamed: ${JSON.stringify(read.headings)}`);
  await page.close();

  // "Seulement les nouveautés": on the 12th, the events first seen on the build's day are still new; on the 14th, two days
  // on, none is, and their marks are off
  const news = await browser.newPage();
  await news.clock.setFixedTime(new Date('2026-11-12T10:00:00+01:00'));
  await news.goto(url);
  await news.getByLabel(/Seulement les nouveautés/).check();
  const onlyNew = await news.evaluate(() => ({
    shown: [...document.querySelectorAll('.event')].filter(event => event.checkVisibility()).map(event => event.hasAttribute('data-new')),
    counts: [...document.querySelectorAll('.day__category:not([hidden])')].map(category => [
      category.querySelector('.day__count')?.textContent,
      String([...category.querySelectorAll('.event')].filter(event => event.checkVisibility()).length),
    ]),
  }));
  if (onlyNew.shown.length === 0 || onlyNew.shown.includes(false)) failures.push('only the new: other events than the new are shown, or none');
  if (onlyNew.counts.some(([shown, left]) => shown !== left)) failures.push('only the new: a category counts other than its new events');
  await news.clock.setFixedTime(new Date('2026-11-14T10:00:00+01:00'));
  await news.reload();
  await news.getByLabel(/Seulement les nouveautés/).check();
  const twoDaysOn = await news.evaluate(() => ({
    marks: [...document.querySelectorAll('.event__new')].filter(mark => mark.checkVisibility()).length,
    count: document.querySelector('.news__count')?.textContent,
    empty: document.querySelector('.news__empty')?.checkVisibility(),
  }));
  if (twoDaysOn.marks > 0 || twoDaysOn.count !== '0' || !twoDaysOn.empty) failures.push(`two days on, events are still new: ${JSON.stringify(twoDaysOn)}`);
  await news.close();
} finally {
  await browser.close();
}

failures.forEach(failure => console.error(failure));
console.log(failures.length ? `${failures.length} problems` : 'No accessibility violation, and the counts follow what has passed');
process.exitCode = failures.length ? 1 : 0;
