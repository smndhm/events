import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Event, PageCache } from '../types.ts';

type Entry = { version: string; events: Event[] };

// By source, then by page address
export type CacheStore = Record<string, Record<string, Entry>>;

// Next to the published events, on the state branch (utils/state.ts)
export const CACHE_FILE = '.state/pages.json';

export const readCache = (file: string = CACHE_FILE): CacheStore => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as CacheStore) : {});

export const writeCache = (store: CacheStore, file: string = CACHE_FILE): void => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(store)}\n`);
};

// A source's part of the cache. Once the source has read its site, commit() keeps only the pages it asked for: a page
// gone from the site is forgotten. A source that fails does not commit, and keeps all its pages for the next run.
export const sourceCache = (store: CacheStore, source: string): PageCache & { commit: () => void } => {
  const previous = store[source] ?? {};
  const used: Record<string, Entry> = {};
  return {
    get: (url, version) => {
      const entry = previous[url];
      if (entry?.version !== version) return undefined;
      used[url] = entry;
      return entry.events;
    },
    set: (url, version, events) => {
      used[url] = { version, events };
    },
    commit: () => {
      store[source] = used;
    },
  };
};
