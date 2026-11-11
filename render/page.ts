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
  const meta = [event.details ? '' : when(event), where(event)].filter(Boolean).join(' · ');
  return `<li data-category="${event.category}">
          <a href="${escape(event.url)}">${escape(event.title)}</a>${isNew(event, now, newDays) ? ' <strong class="new">Nouveau</strong>' : ''}
          <p><span class="tag tag-${event.category}">${SHORT_LABELS[event.category]}</span> ${escape(meta)}</p>${event.details ? `\n          <p class="details">${escape(event.details)}</p>` : ''}
        </li>`;
};

// The category filter, once there are two categories to choose from, is a set of radio buttons, and CSS hides what they leave out (:has): it works without a script
const filterStyles = (categories: Category[]): string =>
  categories
    .map(
      category => `body:has(#filter-${category}:checked) li:not([data-category="${category}"]),
      body:has(#filter-${category}:checked) section:not(:has(li[data-category="${category}"])) { display: none; }`,
    )
    .join('\n      ');

const filterOption = (id: string, label: string, count: number, checked = false): string =>
  `<label><input type="radio" name="filter" id="filter-${id}"${checked ? ' checked' : ''}> ${label} <span class="count">(${count})</span></label>`;

const renderFilters = (events: KnownEvent[], categories: Category[]): string => {
  return `<fieldset class="filters">
        <legend>Afficher</legend>
        ${[filterOption('all', 'Tout', events.length, true), ...categories.map(category => filterOption(category, CATEGORIES[category], events.filter(event => event.category === category).length))].join('\n        ')}
      </fieldset>`;
};

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
        <ul>
        ${dayEvents.map(event => renderEvent(event, now, settings.newDays)).join('\n        ')}
        </ul>
      </section>`,
  );

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escape(title)}</title>
    <meta name="description" content="Brocantes, vide-greniers, films en VO et sorties à moins de ${settings.radiusKm} km de ${escape(settings.home.name)}.">
    ${feeds.map(feed => `<link rel="alternate" type="application/rss+xml" title="${escape(`${title} : ${feed.label}`)}" href="${feed.path}">`).join('\n    ')}
    <style>
      :root {
        color-scheme: light dark;
        --text: #1d1d1f;
        --muted: #595959;
        --background: #fafafa;
        --surface: #fff;
        --border: #d9d9d9;
        --accent: #0b57d0;
        --new: #8a3b00;
        --brocante: #f3e8d6;
        --cinema: #e3e6f8;
        --sortie: #dff1e4;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --text: #ececec;
          --muted: #b0b0b0;
          --background: #161616;
          --surface: #1f1f1f;
          --border: #3a3a3a;
          --accent: #8ab4f8;
          --new: #ffb27a;
          --brocante: #4a3b22;
          --cinema: #2e3354;
          --sortie: #24432d;
        }
      }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--background); color: var(--text); font: 1rem/1.5 system-ui, sans-serif; }
      header, main, footer { max-width: 48rem; margin: 0 auto; padding: 0 1rem; }
      header { padding-block: 2rem 1rem; }
      h1 { margin: 0 0 0.25rem; font-size: 1.75rem; }
      header p, footer { color: var(--muted); }
      .filters { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin: 0 0 1.5rem; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--surface); }
      .filters legend { padding: 0 0.25rem; font-weight: 600; }
      .count { color: var(--muted); }
      h2 { position: sticky; top: 0; margin: 1.5rem 0 0.5rem; padding: 0.5rem 0; background: var(--background); font-size: 1.15rem; }
      ul { margin: 0; padding: 0; list-style: none; }
      li { margin-bottom: 0.5rem; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--surface); }
      li > a { color: var(--accent); font-weight: 600; }
      li p { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.925rem; }
      li .details { font-size: 0.85rem; }
      .new { color: var(--new); font-size: 0.85rem; }
      .tag { display: inline-block; margin-inline-end: 0.25rem; padding: 0 0.5rem; border-radius: 1rem; color: var(--text); font-size: 0.8rem; }
      ${(Object.keys(CATEGORIES) as Category[]).map(category => `.tag-${category} { background: var(--${category}); }`).join('\n      ')}
      footer { padding-block: 2rem; font-size: 0.925rem; }
      footer a { color: var(--accent); }
      ${filterStyles(categories)}
    </style>
  </head>
  <body>
    <header>
      <h1>${escape(title)}</h1>
      <p>Ce qui arrive dans les ${settings.horizonDays} prochains jours, à moins de ${settings.radiusKm} km. Mis à jour le ${updatedFormat.format(now)}.</p>
    </header>
    <main>
      ${events.length === 0 ? '<p>Rien de prévu pour le moment.</p>' : [...(categories.length > 1 ? [renderFilters(events, categories)] : []), ...sections].join('\n      ')}
    </main>
    <footer>
      <p>Flux RSS : ${feeds.map(feed => `<a href="${feed.path}">${escape(feed.label)}</a>`).join(', ')}.</p>
      <p>Sources : ${settings.sources.map(source => `<a href="${escape(source.homepage)}">${escape(source.label)}</a>`).join(', ')}.</p>
    </footer>
  </body>
</html>
`;
};
