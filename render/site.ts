import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { feedPath, renderPage, type PageSettings } from './page.ts';
import { renderRss } from './rss.ts';
import { CATEGORIES, type Category, type KnownEvent } from '../types.ts';

export type SiteSettings = PageSettings & { siteUrl: string };

// The design system's stylesheet and the fonts it loads, from the package's dist/
const DS_DIST = dirname(createRequire(import.meta.url).resolve('@dume/ds/styles.css'));

// Writes the site in `dir`: the page, its feeds, and the design system next to them, as ds/
export const writeSite = (dir: string, events: KnownEvent[], settings: SiteSettings, now: Date): void => {
  const write = (path: string, content: string): void => {
    const file = join(dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };

  write('index.html', renderPage(events, settings, now));
  cpSync(join(DS_DIST, 'styles.css'), join(dir, 'ds', 'styles.css'));
  cpSync(join(DS_DIST, 'fonts'), join(dir, 'ds', 'fonts'), { recursive: true });

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
