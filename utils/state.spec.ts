import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readState, writeState } from './state.ts';
import type { KnownEvent } from '../types.ts';

const event = (id: string): KnownEvent => ({
  id,
  source: 's',
  category: 'brocante',
  title: id,
  start: '2026-11-14',
  place: 'Auray',
  url: 'https://example.org',
  firstSeen: '2026-11-11T00:00:00.000Z',
});

describe('state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'events-state-'));

  it('reads nothing when there is no file', () => {
    expect(readState(join(dir, 'none', 'events.json'))).toEqual([]);
  });

  it('writes the events sorted, one per line, and reads them back', () => {
    const file = join(dir, 'nested', 'events.json');
    writeState([event('b'), event('a')], file);
    expect(readFileSync(file, 'utf8').split('\n')).toHaveLength(5);
    expect(readState(file).map(({ id }) => id)).toEqual(['a', 'b']);
  });

  it('refuses a file that does not hold an array', () => {
    const file = join(dir, 'object.json');
    writeFileSync(file, '{}');
    expect(() => readState(file)).toThrow('does not hold an array');
  });
});
