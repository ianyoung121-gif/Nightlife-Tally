export type Coordinates = {
  latitude: number;
  longitude: number;
};

type VenueLocation = {
  latitude?: number | null;
  longitude?: number | null;
  locationVerifiedAt?: string | null;
};

export function hasVerifiedVenueLocation(
  venue: VenueLocation,
): venue is VenueLocation & Coordinates & { locationVerifiedAt: string } {
  return (
    typeof venue.latitude === 'number' &&
    Number.isFinite(venue.latitude) &&
    venue.latitude >= -90 &&
    venue.latitude <= 90 &&
    typeof venue.longitude === 'number' &&
    Number.isFinite(venue.longitude) &&
    venue.longitude >= -180 &&
    venue.longitude <= 180 &&
    typeof venue.locationVerifiedAt === 'string'
  );
}

export function distanceMiles(from: Coordinates, to: Coordinates): number {
  const earthRadiusMiles = 3958.8;
  const deltaLatitude = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLongitude = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(deltaLongitude / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(distance: number | null): string {
  if (distance === null) return 'Distance unavailable';
  if (distance < 0.1) return '< 0.1 mi away';
  return `${distance.toFixed(1)} mi away`;
}