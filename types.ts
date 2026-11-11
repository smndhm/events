// What the page groups its events by. A source gives each event one of them.
export const CATEGORIES = {
  brocante: 'Brocantes et vide-greniers',
  cinema: 'Films en VO',
  sortie: 'Sorties',
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
};

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
  fetchEvents: () => Promise<Event[]>;
};
