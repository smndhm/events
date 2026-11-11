import { escape, shortDay, when, where } from './format.ts';
import { parisDay } from '../utils/dates.ts';
import type { KnownEvent } from '../types.ts';

export type Feed = { title: string; description: string; link: string; self: string };

// "sam. 15 nov. · Vide grenier · Hennebont, 12 km"
const itemTitle = (event: KnownEvent): string => [shortDay(parisDay(event.start)), event.title, where(event)].join(' · ');

const item = (event: KnownEvent): string => {
  const details = [when(event), event.address, event.place].filter(Boolean).join(' · ');
  return `    <item>
      <title>${escape(itemTitle(event))}</title>
      <link>${escape(event.url)}</link>
      <guid isPermaLink="false">${escape(event.id)}</guid>
      <pubDate>${new Date(event.firstSeen).toUTCString()}</pubDate>
      <description>${escape(details)}</description>
    </item>`;
};

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
${items.map(item).join('\n')}
  </channel>
</rss>
`;
};
