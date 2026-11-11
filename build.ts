// pnpm build: reads every source, then writes the site into _site/ (the page, its feeds and the design system) and what it published into
// the state, for the next run. Exits with 1 when a source failed, after writing everything: the page still goes out,
// with that source's events of the last run, and the run reddens so it is seen.
import { appendFileSync } from 'node:fs';
import { home, horizonDays, newDays, radiusKm, siteUrl, sources } from './config.ts';
import { writeSite } from './render/site.ts';
import { readCache, writeCache } from './utils/cache.ts';
import { collect, type SourceReport } from './utils/collect.ts';
import { readState, writeState } from './utils/state.ts';
import type { KnownEvent } from './types.ts';

const SITE_DIR = '_site';

// What each source gave, at the top of the run's page on GitHub
const summary = (reports: SourceReport[], events: KnownEvent[], now: Date): string => {
  const fresh = events.filter(event => event.firstSeen === now.toISOString()).length;
  const lines = reports.map(({ name, events: count, error }) =>
    error ? `- **${name}: failed**, its ${count} events of the last run kept: ${String(error)}` : `- ${name}: ${count} events`,
  );
  return ['## Events', '', ...lines, '', `${events.length} published, ${fresh} new.`, ''].join('\n');
};

export default async function build(now: Date = new Date()): Promise<SourceReport[]> {
  const cache = readCache();
  const { events, reports } = await collect(sources, readState(), { home, radiusKm, horizonDays }, cache, now);

  writeSite(SITE_DIR, events, { home, radiusKm, horizonDays, newDays, sources, siteUrl }, now);
  writeState(events);
  writeCache(cache);

  reports.forEach(({ name, events: count, error }) =>
    error ? console.error(`::error::${name} failed, its ${count} events of the last run kept:`, error) : console.log(`${name}: ${count} events`),
  );
  console.log(`${events.length} events published in ${SITE_DIR}/`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(reports, events, now));
  return reports;
}

if (import.meta.main) {
  const reports = await build();
  process.exitCode = reports.some(report => report.error) ? 1 : 0;
}
