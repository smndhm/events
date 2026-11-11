// The page, built with the design system, @dume/ds: its layout, its card for each event, its stack for each day's list,
// its footer and its utilities. render/site.ts copies its stylesheet and fonts next to the page, as ds/.
import { dayTitle, escape, listedOn, when, where } from './format.ts';
import { parisDay } from '../utils/dates.ts';
import { CATEGORIES, type Category, type KnownEvent, type Source } from '../types.ts';

export type PageSettings = {
  home: { name: string };
  radiusKm: number;
  horizonDays: number;
  newDays: number;
  sources: Pick<Source, 'label' | 'homepage'>[];
};

const SHORT_LABELS: Record<Category, string> = { brocante: 'Brocante', cinema: 'Ciné VO', sortie: 'Sortie' };

const updatedFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' });

const isNew = (event: KnownEvent, now: Date, newDays: number): boolean => now.getTime() - new Date(event.firstSeen).getTime() < newDays * 86_400_000;

const renderEvent = (event: KnownEvent, now: Date, newDays: number): string => {
  // Details, such as a film's showtimes, can run long: on a line of their own, under the place
  const meta = [SHORT_LABELS[event.category], event.details ? '' : when(event), where(event)].filter(Boolean).join(' · ');
  return `<li class="ds-c-card" data-category="${event.category}">
            <p><a href="${escape(event.url)}">${escape(event.title)}</a>${isNew(event, now, newDays) ? ' <strong class="ds-u-text-primary">Nouveau</strong>' : ''}</p>
            <p class="ds-u-text-muted">${escape(meta)}</p>${event.details ? `\n            <p class="ds-u-text-muted">${escape(event.details)}</p>` : ''}
          </li>`;
};

// The category filter, once there are two categories to choose from, is a set of radio buttons, and CSS hides what they
// leave out (:has): it works without a script
const filterStyles = (categories: Category[]): string =>
  categories
    .map(
      category => `body:has(#filter-${category}:checked) li:not([data-category='${category}']),
      body:has(#filter-${category}:checked) section:not(:has(li[data-category='${category}'])) {
        display: none;
      }`,
    )
    .join('\n      ');

const filterOption = (id: string, label: string, count: number, checked = false): string =>
  `<label><input type="radio" name="filter" id="filter-${id}"${checked ? ' checked' : ''}> ${label} <span class="ds-u-text-muted">(${count})</span></label>`;

const renderFilters = (events: KnownEvent[], categories: Category[]): string => `<fieldset class="ds-c-card filters">
        <legend>Afficher</legend>
        <div class="ds-l-cluster">
          ${[
            filterOption('all', 'Tout', events.length, true),
            ...categories.map(category => filterOption(category, CATEGORIES[category], events.filter(event => event.category === category).length)),
          ].join('\n          ')}
        </div>
      </fieldset>`;

export const feedPath = (category?: Category): string => (category ? `rss/${category}.xml` : 'rss.xml');

export const renderPage = (events: KnownEvent[], settings: PageSettings, now: Date): string => {
  const today = parisDay(now);
  const title = `Autour de ${settings.home.name}`;
  const categories = (Object.keys(CATEGORIES) as Category[]).filter(category => events.some(event => event.category === category));
  const days = [...Map.groupBy(events, event => listedOn(event, today))].toSorted(([a], [b]) => a.localeCompare(b));
  const feeds = [{ label: 'Tout', path: feedPath() }, ...categories.map(category => ({ label: CATEGORIES[category], path: feedPath(category) }))];

  const sections = days.map(
    ([day, dayEvents]) => `<section aria-labelledby="day-${day}">
        <h2 id="day-${day}">${dayTitle(day, today)}</h2>
        <ul class="ds-l-stack" role="list">
          ${dayEvents.map(event => renderEvent(event, now, settings.newDays)).join('\n          ')}
        </ul>
      </section>`,
  );

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escape(title)}</title>
    <meta name="description" content="Brocantes, vide-greniers, films en VO, concerts et spectacles à moins de ${settings.radiusKm} km de ${escape(settings.home.name)}.">
    ${feeds.map(feed => `<link rel="alternate" type="application/rss+xml" title="${escape(`${title} : ${feed.label}`)}" href="${feed.path}">`).join('\n    ')}
    <link rel="preload" href="ds/fonts/bricolage-grotesque-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
    <!-- The design system, @dume/ds: all of the page's style, but what is its own, below -->
    <link rel="stylesheet" href="ds/styles.css">
    <style>
      /* The filter, a card: the design system styles no fieldset */
      .filters {
        margin: 0;
        min-inline-size: 0;
      }
      .filters legend {
        float: inline-start;
        font-weight: 700;
        margin-block-end: var(--ds-b-size-8);
        padding: 0;
      }
      .filters .ds-l-cluster {
        clear: both;
      }
      /* Each day's heading stays at the top while its events scroll by */
      h2 {
        position: sticky;
        inset-block-start: 0;
        background-color: var(--ds-b-color-background);
        padding-block: var(--ds-b-size-8);
      }
      .ds-c-card p {
        margin-block: 0;
      }
      .ds-c-card p + p {
        margin-block-start: var(--ds-b-size-4);
      }
      ${filterStyles(categories)}
    </style>
  </head>
  <body class="ds-l-page ds-l-page--full-height">
    <main id="main" class="ds-l-page__main">
      <hgroup>
        <h1>${escape(title)}</h1>
        <p class="ds-u-text-muted">Ce qui arrive dans les ${settings.horizonDays} prochains jours, à moins de ${settings.radiusKm}&nbsp;km. Mis à jour le ${updatedFormat.format(now)}.</p>
      </hgroup>
      ${events.length === 0 ? '<p>Rien de prévu pour le moment.</p>' : [...(categories.length > 1 ? [renderFilters(events, categories)] : []), ...sections].join('\n      ')}
    </main>
    <footer class="ds-c-footer">
      <ul class="ds-l-cluster">
        ${feeds.map(feed => `<li><a href="${feed.path}">Flux RSS : ${escape(feed.label.toLowerCase())}</a></li>`).join('\n        ')}
      </ul>
      <p class="ds-u-text-muted">Sources : ${settings.sources.map(source => `<a href="${escape(source.homepage)}">${escape(source.label)}</a>`).join(', ')}.</p>
    </footer>
  </body>
</html>
`;
};
