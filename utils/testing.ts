// For the tests: what a source is given on a run
import { sourceCache, type CacheStore } from './cache.ts';
import type { SourceContext } from '../types.ts';

export const context = (now: Date = new Date('2026-11-11T09:00:00Z'), store: CacheStore = {}): SourceContext => ({ now, cache: sourceCache(store, 'test') });
