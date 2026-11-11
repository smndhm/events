// Brocabrac, flea markets and garage sales by department: brocabrac.fr/56/, then ?p=2, ?p=3... until a page holds no
// event, or redirects. Each event is in the page as schema.org JSON-LD.
import { addDays, isDayOnly, lastDay, parisDay } from '../utils/dates.ts';
import { fetchPage } from '../utils/http.ts';
import { decodeEntities, readJsonLdEvents, type JsonLdEvent } from '../utils/json-ld.ts';
import type { Event, Source } from '../types.ts';

const NAME = 'brocabrac';

// About forty events a page: the Morbihan's next year takes four or five
const MAX_PAGES = 15;

const toNumber = (value: number | string | undefined): number | undefined => {
  const number = Number(value);
  return value === undefined || Number.isNaN(number) ? undefined : number;
};

const toImage = (image: JsonLdEvent['image']): string | undefined => {
  if (Array.isArray(image)) return image[0];
  return typeof image === 'string' ? image : image?.url;
};

// One day of an event. A garage sale on five days is in the page five times, under the same address.
const toOccurrence = (item: JsonLdEvent): Event[] => {
  const { name, url, startDate, location } = item;
  if (!name || !url || !startDate || item.eventStatus?.endsWith('EventCancelled')) return [];
  const address = typeof location?.address === 'object' ? location.address : undefined;
  // A bare start day sometimes comes with an end at its opening time: that end says nothing
  const end = item.endDate && !isDayOnly(startDate) && item.endDate > startDate ? item.endDate : undefined;
  return [
    {
      id: `${NAME}:${url}`,
      source: NAME,
      category: 'brocante',
      title: decodeEntities(name),
      start: startDate,
      end,
      place: address?.addressLocality ?? location?.name ?? '',
      address: address?.streetAddress,
      lat: toNumber(location?.geo?.latitude),
      lon: toNumber(location?.geo?.longitude),
      url,
      image: toImage(item.image),
    },
  ];
};

export const parsePage = (html: string): Event[] => readJsonLdEvents(html).flatMap(toOccurrence);

// The days of an event that follow one another become one event, from the first to the last. Days apart stay apart: a
// market held each Sunday is one event per Sunday, rather than one spanning the season.
//
// Its id gets its last day, not its first: the site drops the days gone by, so an event on until Sunday starts a day
// later on each run, and an id with its first day would make it a new event every morning.
export const joinDays = (occurrences: Event[]): Event[] => {
  const byUrl = Map.groupBy(occurrences, ({ url }) => url);
  return [...byUrl.values()].flatMap(days => {
    const sorted = days.toSorted((a, b) => a.start.localeCompare(b.start));
    const joined: Event[] = [];
    for (const day of sorted) {
      const previous = joined.at(-1);
      const previousLast = previous && parisDay(previous.end ?? previous.start);
      if (previous && previousLast && parisDay(day.start) <= addDays(previousLast, 1)) {
        previous.end = day.end ?? day.start;
      } else {
        joined.push({ ...day });
      }
    }
    return joined.map(event => ({ ...event, id: `${event.id}@${lastDay(event)}` }));
  });
};

export default function brocabrac({ department }: { department: string }): Source {
  return {
    name: NAME,
    label: 'Brocabrac',
    homepage: `https://brocabrac.fr/${department}/`,
    fetchEvents: async () => {
      const occurrences: Event[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { status, html } = await fetchPage(`https://brocabrac.fr/${department}/${page > 1 ? `?p=${page}` : ''}`);
        const events = status === 200 ? parsePage(html) : [];
        if (events.length === 0) break;
        occurrences.push(...events);
      }
      return joinDays(occurrences);
    },
  };
}
