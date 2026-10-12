const PLACE_ID = /^[A-Za-z0-9_-]{10,200}$/;
export function validPlaceId(id: unknown): id is string {
  return typeof id === "string" && PLACE_ID.test(id);
}

export async function getPublicPlace(providerId: string) {
  if (!validPlaceId(providerId)) throw new Error("Invalid place");
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Venue information is unavailable");
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(providerId)}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,websiteUri,googleMapsUri,nationalPhoneNumber,regularOpeningHours.weekdayDescriptions,businessStatus",
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Venue information could not be loaded");
  const place = await response.json() as {
    displayName?: { text?: string }; formattedAddress?: string; websiteUri?: string;
    googleMapsUri?: string; nationalPhoneNumber?: string; businessStatus?: string;
    regularOpeningHours?: { weekdayDescriptions?: string[] };
  };
  return {
    providerId, name: place.displayName?.text ?? "Venue",
    address: place.formattedAddress ?? null,
    websiteUri: place.websiteUri ?? null,
    googleMapsUri: place.googleMapsUri ?? null,
    phone: place.nationalPhoneNumber ?? null,
    hours: place.regularOpeningHours?.weekdayDescriptions ?? [],
    businessStatus: place.businessStatus ?? null,
  };
}
