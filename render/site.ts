import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { eventCalendar, icsPath, renderIcs, screeningCalendar, screeningKey } from './ics.ts';
import { feedPath, renderPage, type PageSettings } from './page.ts';
import { renderRss } from './rss.ts';
import { CATEGORIES, type Category, type KnownEvent } from '../types.ts';

export type SiteSettings = PageSettings & { siteUrl: string };

// The design system's stylesheet and the fonts it loads, from the package's dist/
const DS_DIST = dirname(createRequire(import.meta.url).resolve('@dume/ds/styles.css'));

// A file's address with a version from its content
const versioned = (path: string, source: string | URL): string => `${path}?v=${createHash('sha1').update(readFileSync(source)).digest('hex').slice(0, 8)}`;

// Writes the site in `dir`: the page, its own stylesheet and script, its feeds, its calendar files, and the design system next to
// them, as ds/
export const writeSite = (dir: string, events: KnownEvent[], settings: SiteSettings, now: Date): void => {
  const write = (path: string, content: string): void => {
    const file = join(dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };

  const DS_STYLES = join(DS_DIST, 'styles.css');
  const PAGE_CSS = new URL('page.css', import.meta.url);
  const PAGE_JS = new URL('page.js', import.meta.url);
  const assets = { ds: versioned('ds/styles.css', DS_STYLES), css: versioned('page.css', PAGE_CSS), js: versioned('page.js', PAGE_JS) };
  write('index.html', renderPage(events, { ...settings, assets }, now));
  // A calendar file per event, and per showtime of a film
  for (const event of events) {
    if (!event.showings) write(icsPath(event.id), renderIcs(eventCalendar(event), now));
    for (const showing of event.showings ?? []) {
      for (const at of showing.days.flatMap(({ times }) => times)) {
        write(icsPath(screeningKey(event, showing, at)), renderIcs(screeningCalendar(event, showing, at), now));
      }
    }
  }
  cpSync(DS_STYLES, join(dir, 'ds', 'styles.css'));
  cpSync(join(DS_DIST, 'fonts'), join(dir, 'ds', 'fonts'), { recursive: true });
  cpSync(PAGE_CSS, join(dir, 'page.css'));
  cpSync(PAGE_JS, join(dir, 'page.js'));

  const title = `Autour de ${settings.home.name}`;
  const { siteUrl, radiusKm } = settings;
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
};
