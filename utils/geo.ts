const EARTH_RADIUS_KM = 6371;

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

type Point = { lat: number; lon: number };

// As the crow flies (haversine), in kilometres: close enough to tell what is worth the drive
export const distanceKm = (from: Point, to: Point): number => {
  const dLat = radians(to.lat - from.lat);
  const dLon = radians(to.lon - from.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};
