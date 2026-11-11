import { describe, expect, it } from 'vitest';
import { sourceCache, type CacheStore } from './cache.ts';
import type { Event } from '../types.ts';

const event = { id: 'a', source: 's', category: 'sortie', title: 'A', start: '2026-12-19', place: 'Auray', url: 'https://example.org/a' } satisfies Event;

describe('sourceCache', () => {
  it('gives a page only at the same version', () => {
    const cache = sourceCache({ s: { 'https://example.org/a': { version: '1', events: [event] } } }, 's');
    expect(cache.get('https://example.org/a', '1')).toEqual([event]);
    expect(cache.get('https://example.org/a', '2')).toBeUndefined();
  });

  it('keeps, once committed, only the pages asked for or set', () => {
    const store: CacheStore = { s: { kept: { version: '1', events: [] }, gone: { version: '1', events: [] } }, other: {} };
    const cache = sourceCache(store, 's');
    cache.get('kept', '1');
    cache.set('new', '1', [event]);
    cache.commit();
    expect(Object.keys(store.s ?? {})).toEqual(['kept', 'new']);
    expect(store.other).toEqual({});
  });

  it('changes nothing without a commit', () => {
    const store: CacheStore = { s: { kept: { version: '1', events: [] } } };
    sourceCache(store, 's').set('new', '1', []);
    expect(Object.keys(store.s ?? {})).toEqual(['kept']);
  });
});
