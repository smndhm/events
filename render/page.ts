// The page, built with the design system, @dume/ds: its layout, its card for each event, its stack for each day's list,
// its footer and its utilities. render/site.ts copies its stylesheet and fonts next to the page, as ds/.
import { dayTitle, escape, listedOn, showingDay, time, when, where } from './format.ts';
import { icsPath, screeningKey } from './ics.ts';
import { isDayOnly, parisDay } from '../utils/dates.ts';
import { CATEGORIES, type Category, type KnownEvent, type Source } from '../types.ts';

export type PageSettings = {
  home: { name: string };
  radiusKm: number;
  horizonDays: number;
  newDays: number;
  sources: Pick<Source, 'label' | 'homepage'>[];
};

const SHORT_LABELS: Record<Category, string> = { brocante: 'Brocante', cinema: 'Ciné', sortie: 'Sortie' };

const updatedFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' });

const isNew = (event: KnownEvent, now: Date, newDays: number): boolean => now.getTime() - new Date(event.firstSeen).getTime() < newDays * 86_400_000;

const plural = (count: number, word: string): string => `${count} ${word}${count > 1 ? 's' : ''}`;

// A link to the calendar file of an event or a showtime, its hidden text saying what it does, "20:30" alone not saying it
const calendarLink = (key: string, text: string, hint: string): string => `<a href="${icsPath(key)}">${escape(text)}<span class="ds-u-visually-hidden">${escape(hint)}</span></a>`;

// A film's cinemas, the nearest first, each folded, then each of its days folded: a day shows its times, each a link
// adding that showtime to the calendar, and the cinema's showtimes that day on Allociné
const renderShowings = (event: KnownEvent): string => `
            <ul class="showings" role="list">
              ${(event.showings ?? [])
                .map(
                  showing => `<li>
                <details class="showings__theater">
                  <summary><strong>${escape(showing.place)}</strong> <span class="ds-u-text-muted">${[showing.distance === undefined ? '' : `${showing.distance}&nbsp;km`, plural(showing.days.length, 'jour')].filter(Boolean).join(' · ')}</span></summary>
                  <ul class="showings__days" role="list">
                    ${showing.days
                      .map(
                        ({ day, url, times }) => `<li>
                      <details class="showings__day">
                        <summary>${showingDay(day)} <span class="ds-u-text-muted">· ${plural(times.length, 'séance')}</span></summary>
                        <p class="showings__times">${times.map(at => calendarLink(screeningKey(event, showing, at), time(at), ", ajouter la séance à l'agenda")).join(', ')}</p>
                        <p class="showings__link"><a href="${escape(url)}">Séances du jour sur Allociné<span class="ds-u-visually-hidden"> : ${escape(showing.place)}, ${showingDay(day)}</span></a></p>
                      </details>
                    </li>`,
                      )
                      .join('\n                    ')}
                  </ul>
                  <p class="showings__link showings__link--theater"><a href="${escape(showing.url)}">Toutes ses séances sur Allociné<span class="ds-u-visually-hidden"> : ${escape(showing.place)}</span></a></p>
                </details>
              </li>`,
                )
                .join('\n              ')}
            </ul>`;

const renderEvent = (event: KnownEvent, now: Date, newDays: number): string => {
  // A film's showtimes are in lists under it, its cinemas each with its distance: its line says how many cinemas show it
  const meta = event.showings
    ? [SHORT_LABELS[event.category], plural(event.showings.length, 'cinéma')].join(' · ')
    : [SHORT_LABELS[event.category], when(event), where(event)].filter(Boolean).join(' · ');
  return `<li class="ds-c-card event" data-category="${event.category}">
            <p class="event__title"><a href="${escape(event.url)}">${escape(event.title)}</a>${isNew(event, now, newDays) ? ' <span class="ds-c-tag">Nouveau</span>' : ''}</p>
            <p class="ds-u-text-muted event__meta">${escape(meta)}</p>${
              event.showings
                ? renderShowings(event)
                : `\n            <p class="event__meta"><small>${calendarLink(event.id, "Ajouter à l'agenda", ` : ${event.title}`)}</small></p>`
            }
          </li>`;
};

// The order of a day's events: those already started, then those of the whole day, then the others by their time; the
// nearest first at the same time
const byTimeThenDistance = (day: string): ((a: KnownEvent, b: KnownEvent) => number) => {
  const rank = (event: KnownEvent): number => (parisDay(event.start) < day ? 0 : isDayOnly(event.start) ? 1 : 2);
  const clock = (event: KnownEvent): string => (rank(event) === 2 ? time(event.start) : '');
  return (a, b) => rank(a) - rank(b) || clock(a).localeCompare(clock(b)) || (a.distance ?? Infinity) - (b.distance ?? Infinity);
};

// The category filter, once there are two categories to choose from, is a set of radio buttons, and CSS hides what they
// leave out (page.css): it works without a script
const filterOption = (id: string, label: string, count: number, checked = false): string =>
  `<div class="ds-c-radio"><input class="ds-c-radio__control" type="radio" name="filter" id="filter-${id}"${checked ? ' checked' : ''}><label class="ds-c-radio__label" for="filter-${id}">${label} <span class="ds-u-text-muted">(${count})</span></label></div>`;

const renderFilters = (events: KnownEvent[], categories: Category[]): string => `<fieldset class="ds-c-card">
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
    ([day, dayEvents]) => `<section class="day" aria-labelledby="day-${day}">
        <h2 class="day__heading" id="day-${day}">${dayTitle(day, today)}</h2>
        <ul class="ds-l-stack" role="list">
          ${dayEvents
            .toSorted(byTimeThenDistance(day))
            .map(event => renderEvent(event, now, settings.newDays))
            .join('\n          ')}
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
    <!-- The design system, @dume/ds: all of the page's style, but what is its own -->
    <link rel="stylesheet" href="ds/styles.css">
    <!-- What is the page's own, over it: its filter, its days and its events (render/page.css) -->
    <link rel="stylesheet" href="page.css">
  </head>
  <body class="ds-l-page ds-l-page--full-height">
    <main id="main" class="ds-l-page__main">
      <hgroup>
        <h1>${escape(title)}</h1>
        <p class="ds-u-text-muted">Ce qui arrive dans les ${settings.horizonDays} prochains jours, à moins de ${settings.radiusKm}&nbsp;km. Mis à jour le ${updatedFormat.format(now)}.</p>
        <p class="ds-u-text-muted">Un événement, ou l'horaire d'une séance, s'ajoute à votre agenda d'un clic.</p>
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
