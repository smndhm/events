// What the page groups its events by. A source gives each event one of them.
export const CATEGORIES = {
  brocante: 'Brocantes et vide-greniers',
  cinema: 'Films en VO ou en français',
  sortie: 'Concerts, spectacles et sorties',
} as const;

export type Category = keyof typeof CATEGORIES;

// An event, as every source gives it, whatever the site it read
export type Event = {
  // Stable from one run to the next: it is what tells a new event from one already seen
  id: string;
  // The name of the source that gave it, see config.ts
  source: string;
  category: Category;
  title: string;
  // ISO 8601, with the offset the site gave, or a bare day (YYYY-MM-DD) when it gave no time
  start: string;
  end?: string;
  // The town, and the street when the site gives it
  place: string;
  address?: string;
  lat?: number;
  lon?: number;
  url: string;
  image?: string;
  // Lines shown in place of the hours, such as a film's showtimes in each cinema
  details?: Segment[][];
};

// A piece of a line of details: text, or a link. `hint`, read by screen readers only, says where the link goes when its
// text alone does not ("mer. 11": the showtimes of that day, in that cinema)
export type Segment = { text: string; url?: string; hint?: string };

// An event as the page and the feeds show it: with how far it is, and the day it was first seen, which the state
// branch remembers
export type KnownEvent = Event & {
  // Kilometres from home, as the crow flies; none when the site gives no coordinates
  distance?: number;
  // ISO 8601
  firstSeen: string;
};

export type Source = {
  // Names the source in the logs, the run's summary and the events it gives
  name: string;
  // Credits it at the foot of the page
  label: string;
  homepage: string;
  fetchEvents: (context: SourceContext) => Promise<Event[]>;
};

export type SourceContext = {
  now: Date;
  // The pages this source read on earlier runs, kept on the state branch (utils/cache.ts)
  cache: PageCache;
};

// What a source made of a page, kept from one run to the next: a site with hundreds of pages is then only read for the
// pages that changed. `version` tells whether the page changed, such as the date the site's sitemap gives it.
export type PageCache = {
  get: (url: string, version: string) => Event[] | undefined;
  set: (url: string, version: string, events: Event[]) => void;
};
