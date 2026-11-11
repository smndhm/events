import { addDays, lastDay, parisDay } from './dates.ts';
import { distanceKm } from './geo.ts';
import { sourceCache, type CacheStore } from './cache.ts';
import type { Event, KnownEvent, Source } from '../types.ts';

export type Settings = {
  home: { lat: number; lon: number };
  radiusKm: number;
  horizonDays: number;
};

export type SourceReport = { name: string; events: number; error?: unknown };

const withDistance = (event: Event, home: Settings['home']): Event & { distance?: number } =>
  event.lat === undefined || event.lon === undefined ? event : { ...event, distance: Math.round(distanceKm(home, { lat: event.lat, lon: event.lon })) };

// Reads every source, one after the other, and returns what to publish: the events not over yet, starting within the
// horizon and within the radius, each with the day it was first seen. A source that fails keeps its events of the last
// run, and its error is in the report; the others are not held back by it. `cache` is updated with the pages the
// sources read.
export const collect = async (
  sources: Source[],
  previous: KnownEvent[],
  settings: Settings,
  cache: CacheStore = {},
  now: Date = new Date(),
): Promise<{ events: KnownEvent[]; reports: SourceReport[] }> => {
  const today = parisDay(now);
  const horizon = addDays(today, settings.horizonDays);
  const firstSeen = new Map(previous.map(event => [event.id, event.firstSeen]));

  const reports: SourceReport[] = [];
  const events: Event[] = [];
  for (const source of sources) {
    const pages = sourceCache(cache, source.name);
    try {
      const fetched = await source.fetchEvents({ now, cache: pages });
      pages.commit();
      events.push(...fetched);
      reports.push({ name: source.name, events: fetched.length });
    } catch (error) {
      const kept = previous.filter(event => event.source === source.name);
      events.push(...kept);
      reports.push({ name: source.name, events: kept.length, error });
    }
  }

  const unique = [...new Map(events.map(event => [event.id, event])).values()];
  return {
    reports,
    events: unique
      .filter(event => lastDay(event) >= today && parisDay(event.start) <= horizon)
      .map(event => withDistance(event, settings.home))
      .filter(event => event.distance === undefined || event.distance <= settings.radiusKm)
      .map(event => ({ ...event, firstSeen: firstSeen.get(event.id) ?? now.toISOString() }))
      .toSorted((a, b) => a.start.localeCompare(b.start)),
  };
};
