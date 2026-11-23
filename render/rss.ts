import { escape, shortDay, showingDay, time, when, where } from './format.ts';
import { icsPath, screeningKey } from './ics.ts';
import { parisDay } from '../utils/dates.ts';
import type { KnownEvent } from '../types.ts';

export type Feed = { title: string; description: string; link: string; self: string };

// "sam. 15 nov. · Vide grenier · Hennebont, 12 km"
const itemTitle = (event: KnownEvent): string => [shortDay(parisDay(event.start)), event.title, where(event)].join(' · ');

// What a reader shows of an item, as HTML: when and where; a film's showtimes in each cinema, each time a link adding it to
// the calendar; what the site says of it, its paragraphs apart; and, but for a film, a link adding it to the calendar.
// `site` is the page's address, the calendar files' links being absolute in a reader.
export const itemHtml = (event: KnownEvent, site: string): string => {
  const calendar = (key: string): string => escape(`${site}${icsPath(key)}`);
  const showings = (event.showings ?? []).map(
    showing =>
      `<li>${escape(showing.place)}${showing.distance === undefined ? '' : `, ${showing.distance}\u00a0km`} : ${showing.days
        .map(({ day, times }) => `${showingDay(day)} ${times.map(at => `<a href="${calendar(screeningKey(event, showing, at))}">${time(at)}</a>`).join(', ')}`)
        .join(' · ')}</li>`,
  );
  return [
    event.showings ? `<ul>${showings.join('')}</ul>` : `<p>${escape([when(event), event.address, event.place].filter(Boolean).join(' · '))}</p>`,
    ...(event.description ? [`<p>${escape(event.description).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`] : []),
    event.showings ? "<p>Un horaire ajoute la séance à l'agenda.</p>" : `<p><a href="${calendar(event.id)}">Ajouter à l'agenda</a></p>`,
  ].join('');
};

const item = (event: KnownEvent, site: string): string => `    <item>
      <title>${escape(itemTitle(event))}</title>
      <link>${escape(event.url)}</link>
      <guid isPermaLink="false">${escape(event.id)}</guid>
      <pubDate>${new Date(event.firstSeen).toUTCString()}</pubDate>
      <description>${escape(itemHtml(event, site))}</description>
    </item>`;

// An item per event, dated by the day it was first seen: a reader shows it once, when it appears, rather than again on
// every run. Newest first.
export const renderRss = (feed: Feed, events: KnownEvent[], now: Date): string => {
  const items = events.toSorted((a, b) => b.firstSeen.localeCompare(a.firstSeen) || a.start.localeCompare(b.start));
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(feed.title)}</title>
    <link>${escape(feed.link)}</link>
    <description>${escape(feed.description)}</description>
    <language>fr-FR</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <atom:link href="${escape(feed.self)}" rel="self" type="application/rss+xml"/>
${items.map(event => item(event, feed.link)).join('\n')}
  </channel>
</rss>
`;
};
