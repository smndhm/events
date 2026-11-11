import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { KnownEvent } from '../types.ts';

// What the last run published, with the day each event was first seen. It is what lets the feeds hold an event once,
// rather than every day, and what stands in for a source that fails: its events from the last run are kept.
//
// A file on a branch of its own, events-state, which the Site workflow checks out here and commits. No file, as on the
// first run or from a terminal, is an empty memory: every event is new.
export const STATE_FILE = '.state/events.json';

export const readState = (file: string = STATE_FILE): KnownEvent[] => {
  if (!existsSync(file)) return [];
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`${file} does not hold an array.`);
  }
  return parsed as KnownEvent[];
};

export const writeState = (events: KnownEvent[], file: string = STATE_FILE): void => {
  mkdirSync(dirname(file), { recursive: true });
  // One event per line, sorted: a commit shows the events that came and went
  const sorted = events.toSorted((a, b) => a.id.localeCompare(b.id));
  writeFileSync(file, `[\n${sorted.map(event => JSON.stringify(event)).join(',\n')}\n]\n`);
};
