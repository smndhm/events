// The agenda of Morbihan Tourisme, morbihan.com: concerts, plays, shows, and what the towns and their associations put on,
// such as the Espace Kerverh in Landévant. Its listing covers the whole department with no filter to narrow it, but its
// sitemap gives every event page with the date it last changed, and each page describes its event in JSON-LD. So the
// sitemap is read on each run, and only the pages new or changed since the last one (the cache).
import { addDays, parisDay } from '../utils/dates.ts';
import { fetchPage } from '../utils/http.ts';
import { decodeEntities, readJsonLdEvents, type JsonLdEvent } from '../utils/json-ld.ts';
import type { Event, Source } from '../types.ts';

const NAME = 'morbihan';
const SITEMAP = 'https://morbihan.com/sitemap.xml/';
const AGENDA_PAGE = /^https:\/\/morbihan\.com\/a-voir-a-faire\/agenda\/tout-lagenda\/[^/]+-fr-\d+\/$/;

// Weekly markets and exhibitions run for months, and would be on every day of the page: what lasts longer is left out
const MAX_DAYS = 14;

// Pages read at once
const CONCURRENCY = 4;

const LOC = /<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g;

const readLocs = (xml: string): { url: string; lastmod: string }[] => [...xml.matchAll(LOC)].map(([, url, lastmod]) => ({ url: url ?? '', lastmod: lastmod ?? '' }));

export const readSitemapIndex = (xml: string): string[] => readLocs(xml).map(({ url }) => url);

export const readAgendaPages = (xml: string): { url: string; lastmod: string }[] => readLocs(xml).filter(({ url }) => AGENDA_PAGE.test(url));

const toNumber = (value: number | string | undefined): number | undefined => {
  const number = Number(value);
  return value === undefined || value === '' || Number.isNaN(number) ? undefined : number;
};

const toEvent = (item: JsonLdEvent, url: string): Event[] => {
  const { name, startDate, location } = item;
  if (!name || !startDate || item.eventStatus?.endsWith('EventCancelled')) return [];
  const end = item.endDate && item.endDate > startDate ? item.endDate : undefined;
  if (end && parisDay(end) > addDays(parisDay(startDate), MAX_DAYS)) return [];
  const address = typeof location?.address === 'object' ? location.address : undefined;
  const image = Array.isArray(item.image) ? item.image[0] : typeof item.image === 'string' ? item.image : undefined;
  return [
    {
      id: `${NAME}:${url}`,
      source: NAME,
      category: 'sortie',
      title: decodeEntities(name),
      start: startDate,
      end: end && parisDay(end) !== parisDay(startDate) ? end : undefined,
      place: address?.addressLocality ?? '',
      address: address?.streetAddress || undefined,
      lat: toNumber(location?.geo?.latitude),
      lon: toNumber(location?.geo?.longitude),
      url,
      image,
    },
  ];
};

export const parseEventPage = (html: string, url: string): Event[] => readJsonLdEvents(html).flatMap(item => toEvent(item, url));

// Runs the tasks, a few at a time
const inBatches = async <T>(items: T[], task: (item: T) => Promise<void>): Promise<void> => {
  for (let index = 0; index < items.length; index += CONCURRENCY) {
    await Promise.all(items.slice(index, index + CONCURRENCY).map(task));
  }
};

export default function morbihan(): Source {
  return {
    name: NAME,
    label: 'Morbihan Tourisme',
    homepage: 'https://morbihan.com/a-voir-a-faire/agenda/tout-lagenda/',
    fetchEvents: async ({ cache }) => {
      const pages: { url: string; lastmod: string }[] = [];
      for (const sitemap of readSitemapIndex((await fetchPage(SITEMAP)).html)) {
        pages.push(...readAgendaPages((await fetchPage(sitemap)).html));
      }

      const events: Event[] = [];
      const toRead = pages.filter(({ url, lastmod }) => {
        const cached = cache.get(url, lastmod);
        if (cached) events.push(...cached);
        return !cached;
      });
      // A page that fails is left out, and read again on the next run. All of them failing is the site failing.
      const failures: unknown[] = [];
      await inBatches(toRead, async ({ url, lastmod }) => {
        try {
          const read = parseEventPage((await fetchPage(url)).html, url);
          cache.set(url, lastmod, read);
          events.push(...read);
        } catch (error) {
          failures.push(error);
        }
      });
      if (toRead.length > 0 && failures.length === toRead.length) {
        throw new Error(`None of the ${toRead.length} pages to read could be read`, { cause: failures[0] });
      }
      if (failures.length > 0) console.warn(`::warning::${NAME}: ${failures.length} of ${toRead.length} pages could not be read`);
      return events;
    },
  };
}
