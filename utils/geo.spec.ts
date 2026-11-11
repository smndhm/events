import { describe, expect, it } from 'vitest';
import { distanceKm } from './geo.ts';

describe('distanceKm', () => {
  it('measures as the crow flies', () => {
    // Landévant to Hennebont's town hall: about 12 km
    expect(distanceKm({ lat: 47.77442, lon: -3.118101 }, { lat: 47.8048, lon: -3.2779 })).toBeCloseTo(12.5, 0);
    expect(distanceKm({ lat: 47, lon: -3 }, { lat: 47, lon: -3 })).toBe(0);
  });
});
