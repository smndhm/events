// pnpm build: reads every source, then writes the site into _site/ (the page and its feeds) and what it published into
// the state, for the next run. Exits with 1 when a source failed, after writing everything: the page still goes out,
// with that source's events of the last run, and the run reddens so it is seen.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { home, horizonDays, newDays, radiusKm, siteUrl, sources } from './config.ts';
import { feedPath, renderPage } from './render/page.ts';
import { renderRss } from './render/rss.ts';
import { collect, type SourceReport } from './utils/collect.ts';
import { readState, writeState } from './utils/state.ts';
import { CATEGORIES, type Category, type KnownEvent } from './types.ts';

const SITE_DIR = '_site';

const write = (path: string, content: string): void => {
  const file = join(SITE_DIR, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};

// What each source gave, at the top of the run's page on GitHub
const summary = (reports: SourceReport[], events: KnownEvent[], now: Date): string => {
  const fresh = events.filter(event => event.firstSeen === now.toISOString()).length;
  const lines = reports.map(({ name, events: count, error }) =>
    error ? `- **${name}: failed**, its ${count} events of the last run kept: ${String(error)}` : `- ${name}: ${count} events`,
  );
  return ['## Events', '', ...lines, '', `${events.length} published, ${fresh} new.`, ''].join('\n');
};

export default async function build(now: Date = new Date()): Promise<SourceReport[]> {
  const { events, reports } = await collect(sources, readState(), { home, radiusKm, horizonDays }, now);

  write('index.html', renderPage(events, { home, radiusKm, horizonDays, newDays, sources }, now));
  const title = `Autour de ${home.name}`;
  write(feedPath(), renderRss({ title, description: `Ce qui arrive à moins de ${radiusKm} km.`, link: siteUrl, self: `${siteUrl}${feedPath()}` }, events, now));
  // A feed per category, even an empty one, so a reader subscribed to it never meets a missing page
  for (const category of Object.keys(CATEGORIES) as Category[]) {
    const feed = {
      title: `${title} : ${CATEGORIES[category]}`,
      description: `${CATEGORIES[category]} à moins de ${radiusKm} km.`,
      link: siteUrl,
      self: `${siteUrl}${feedPath(category)}`,
    };
    write(
      feedPath(category),
      renderRss(
        feed,
        events.filter(event => event.category === category),
        now,
      ),
    );
  }
  writeState(events);

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
