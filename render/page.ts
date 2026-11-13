// The page, built with the design system, @dume/ds: its layout, its card for each event, its stack for each day's list,
// its footer and its utilities. render/site.ts copies its stylesheet and fonts next to the page, as ds/.
import { createHash } from 'node:crypto';
import { dayTitle, escape, listedOn, showingDay, time, when, where } from './format.ts';
import { icsPath, screeningKey } from './ics.ts';
import { addDays, isDayOnly, lastDay, parisDay, withParisOffset } from '../utils/dates.ts';
import { CATEGORIES, type Category, type KnownEvent, type Source } from '../types.ts';

// The page's stylesheets and script, at the addresses to load them from, such as `page.js?v=1a2b3c4d`: a version from
// each file's content, so a browser never mixes a new page with a file it kept from the last one (render/site.ts)
export type Assets = { ds: string; css: string; js: string };

const PLAIN_ASSETS: Assets = { ds: 'ds/styles.css', css: 'page.css', js: 'page.js' };

export type PageSettings = {
  assets?: Assets;
  home: { name: string };
  radiusKm: number;
  horizonDays: number;
  newDays: number;
  sources: Pick<Source, 'label' | 'homepage'>[];
};

const updatedFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' });

// A short key of its own for each event
const eventKey = (event: KnownEvent): string => createHash('sha1').update(event.id).digest('hex').slice(0, 12);

const isNew = (event: KnownEvent, now: Date, newDays: number): boolean => now.getTime() - new Date(event.firstSeen).getTime() < newDays * 86_400_000;

// A link to the calendar file of an event or a showtime, its hidden text saying what it does, "20:30" alone not saying it
// A showtime's says when it starts (`data-starts`), for page.js to take it out once started
const calendarLink = (key: string, text: string, hint: string, starts?: string): string =>
  `<a href="${icsPath(key)}"${starts ? ` data-starts="${starts}"` : ''}>${escape(text)}<span class="ds-u-visually-hidden">${escape(hint)}</span></a>`;

// A film's cinemas on one day, the nearest first, a line each: its name, a link to its showtimes that day on Allociné,
// its distance, and its times, each a link adding that showtime to the calendar
const renderShowings = (event: KnownEvent): string => `
            <ul class="showings" role="list">
              ${(event.showings ?? [])
                .flatMap(showing =>
                  showing.days.map(
                    ({ day, url, times }) =>
                      `<li class="showings__theater"><a href="${escape(url)}"><strong>${escape(showing.place)}</strong><span class="ds-u-visually-hidden">, séances du ${showingDay(day)} sur Allociné</span></a>${showing.distance === undefined ? '' : ` <span class="ds-u-text-muted">${showing.distance}&nbsp;km</span>`} · <span class="showings__times">${times
                        .map(at => calendarLink(screeningKey(event, showing, at), time(at), ", ajouter la séance à l'agenda", at))
                        .join(', ')}</span></li>`,
                  ),
                )
                .join('\n              ')}
            </ul>`;

// The days an event is listed under, and what it is on each, up to `horizon`. A film is under each day it is shown, with
// that day's showtimes only, from its first to its last of the day. Any other event is under each day it is on, from its
// first, or today when it started before, to its last: a festival until Saturday is under tomorrow too.
const listings = (event: KnownEvent, today: string, horizon: string): [string, KnownEvent][] => {
  const { showings } = event;
  if (!showings) {
    const days: string[] = [];
    for (let day = listedOn(event, today); day <= lastDay(event) && day <= horizon; day = addDays(day, 1)) days.push(day);
    return days.map(day => [day, event]);
  }
  const days = [...new Set(showings.flatMap(showing => showing.days.map(({ day }) => day)))].filter(day => day >= today).toSorted();
  return days.map(day => {
    const ofDay = showings.map(showing => ({ ...showing, days: showing.days.filter(shown => shown.day === day) })).filter(showing => showing.days.length > 0);
    const times = ofDay.flatMap(showing => showing.days.flatMap(shown => shown.times)).toSorted();
    return [day, { ...event, start: times[0] ?? event.start, end: times.at(-1), showings: ofDay }];
  });
};

// When an event is over, for page.js to hide it: its end; the end of its last day, when it is on whole days; two hours
// after its start, when it has no end. A film's listing, at its last showtime of the day.
export const endsAt = (event: KnownEvent): string => {
  if (event.showings) return event.end ?? event.start;
  if (isDayOnly(event.start) || (event.end && isDayOnly(event.end))) return withParisOffset(`${addDays(lastDay(event), 1)}T00:00:00`);
  if (event.end && event.end > event.start) return event.end;
  return new Date(new Date(event.start).getTime() + 2 * 3_600_000).toISOString();
};

// When an event is over on one of its days, for page.js to hide it there: at its end on its last day, at midnight on the
// others, which are then gone by
export const endsOn = (event: KnownEvent, day: string): string => {
  const ends = endsAt(event);
  const midnight = withParisOffset(`${addDays(day, 1)}T00:00:00`);
  return new Date(ends) < new Date(midnight) ? ends : midnight;
};

const renderEvent = (event: KnownEvent, day: string, now: Date, newDays: number): string => {
  // Its category is the folded list it is in: its line says when and where; a film's showtimes say both
  const meta = event.showings ? '' : [when(event), where(event)].filter(Boolean).join(' · ');
  // When it was first seen (`data-first-seen`), for page.js to take its mark off once it is no longer new, and who it is
  // (`data-event`), to count it once among the new ones however many days it is under
  const fresh = isNew(event, now, newDays);
  return `<li class="ds-c-card event" data-category="${event.category}" data-ends="${endsOn(event, day)}" data-first-seen="${event.firstSeen}" data-event="${eventKey(event)}"${fresh ? ' data-new' : ''}>
            <p class="event__title"><a href="${escape(event.url)}">${escape(event.title)}</a>${fresh ? ' <span class="ds-c-tag event__new">Nouveau</span>' : ''}</p>
            ${meta ? `<p class="ds-u-text-muted event__meta">${escape(meta)}</p>` : ''}${
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

// A day's events of one category, open, to be folded when it is not of interest: its summary names the category and
// counts its events, which page.js counts again as they pass
const renderCategory = (
  category: Category,
  events: KnownEvent[],
  day: string,
  now: Date,
  newDays: number,
): string => `<details class="day__category" data-category="${category}" open>
          <summary><strong>${CATEGORIES[category]}</strong> <small class="ds-u-text-muted">(<span class="day__count">${events.length}</span>)</small></summary>
          <ul class="ds-l-stack" role="list">
            ${events
              .toSorted(byTimeThenDistance(day))
              .map(event => renderEvent(event, day, now, newDays))
              .join('\n            ')}
          </ul>
        </details>`;

// A checkbox to see only the events new for `newDays` days: CSS hides the others (page.css), page.js counts again what is
// left and says when nothing is
const renderNews = (events: KnownEvent[], newDays: number, now: Date): string => `<div class="ds-c-checkbox">
        <input class="ds-c-checkbox__control" type="checkbox" id="only-new">
        <label class="ds-c-checkbox__label" for="only-new">Seulement les nouveautés <small class="ds-u-text-muted">(<span class="news__count">${events.filter(event => isNew(event, now, newDays)).length}</span>)</small></label>
      </div>
      <p class="news__empty" hidden>Rien de nouveau depuis ${newDays}&nbsp;jours.</p>`;

export const feedPath = (category?: Category): string => (category ? `rss/${category}.xml` : 'rss.xml');

export const renderPage = (events: KnownEvent[], settings: PageSettings, now: Date): string => {
  const today = parisDay(now);
  const assets = settings.assets ?? PLAIN_ASSETS;
  const title = `Autour de ${settings.home.name}`;
  const categories = (Object.keys(CATEGORIES) as Category[]).filter(category => events.some(event => event.category === category));
  const days = [
    ...Map.groupBy(
      events.flatMap(event => listings(event, today, addDays(today, settings.horizonDays))),
      ([day]) => day,
    ),
  ]
    .map(([day, listed]) => [day, listed.map(([, event]) => event)] as const)
    .toSorted(([a], [b]) => a.localeCompare(b));
  const feeds = [{ label: 'Tout', path: feedPath() }, ...categories.map(category => ({ label: CATEGORIES[category], path: feedPath(category) }))];

  // Each day, its number of events, then its categories in the order of CATEGORIES, each folded
  const sections = days.map(
    ([day, dayEvents]) => `<section class="day" data-day="${day}" aria-labelledby="day-${day}">
        <h2 class="day__heading" id="day-${day}"><span class="day__title">${dayTitle(day, today)}</span> <small class="ds-u-text-muted">(<span class="day__total">${dayEvents.length}</span>)</small></h2>
        <div class="day__categories">
        ${[...Map.groupBy(dayEvents, event => event.category)]
          .toSorted(([a], [b]) => categories.indexOf(a) - categories.indexOf(b))
          .map(([category, categoryEvents]) => renderCategory(category, categoryEvents, day, now, settings.newDays))
          .join('\n        ')}
        </div>
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
    <link rel="stylesheet" href="${assets.ds}">
    <!-- What is the page's own, over it: its days, their categories and its events (render/page.css) -->
    <link rel="stylesheet" href="${assets.css}">
  </head>
  <body class="ds-l-page ds-l-page--full-height">
    <main id="main" class="ds-l-page__main" data-new-days="${settings.newDays}">
      <hgroup>
        <h1>${escape(title)}</h1>
        <p class="ds-u-text-muted">Ce qui arrive dans les ${settings.horizonDays} prochains jours, à moins de ${settings.radiusKm}&nbsp;km. Mis à jour le ${updatedFormat.format(now)}.</p>
        <p class="ds-u-text-muted">Un événement, ou l'horaire d'une séance, s'ajoute à votre agenda d'un clic.</p>
      </hgroup>
      ${events.length === 0 ? '<p>Rien de prévu pour le moment.</p>' : [renderNews(events, settings.newDays, now), ...sections].join('\n      ')}
    </main>
    <footer class="ds-c-footer">
      <ul class="ds-l-cluster">
        ${feeds.map(feed => `<li><a href="${feed.path}">Flux RSS : ${escape(feed.label.toLowerCase())}</a></li>`).join('\n        ')}
      </ul>
      <p class="ds-u-text-muted">Sources : ${settings.sources.map(source => `<a href="${escape(source.homepage)}">${escape(source.label)}</a>`).join(', ')}.</p>
    </footer>
    <!-- What has passed, hidden as the page is read: without it, everything as built (render/page.js) -->
    <script src="${assets.js}" defer></script>
  </body>
</html>
`;
};
