import { Router, type Request } from "express";
import { db, barsTable } from "@workspace/db";
import { barWithStats } from "./bars";

const router = Router();

const DEFAULT_RADIUS_MILES = 5;
const MAX_RADIUS_MILES = 15;
const MAX_RESULTS = 20;
const CACHE_TTL_MS = 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const GOOGLE_NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type DiscoveredVenue = {
  providerId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  googleMapsUri: string | null;
  primaryType: string | null;
};

type CachedDiscovery = {
  expiresAt: number;
  venues: DiscoveredVenue[];
};

const discoveryCache = new Map<string, CachedDiscovery>();
const requestCounts = new Map<string, { windowStartedAt: number; count: number }>();

function getQueryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseNumber(value: unknown): number | undefined {
  const parsed = Number(getQueryString(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCoordinates(req: Request): Coordinates | undefined {
  const latitude = parseNumber(req.query.latitude);
  const longitude = parseNumber(req.query.longitude);
  if (
    latitude === undefined ||
    longitude === undefined ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return undefined;
  }
  return { latitude, longitude };
}

function parseRadiusMiles(req: Request): number {
  const requested = parseNumber(req.query.radiusMiles);
  if (requested === undefined) return DEFAULT_RADIUS_MILES;
  return Math.min(Math.max(requested, 0.5), MAX_RADIUS_MILES);
}

function distanceMiles(from: Coordinates, to: Coordinates): number {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isRateLimited(req: Request): boolean {
  const key = req.ip || "unknown";
  const now = Date.now();
  const current = requestCounts.get(key);
  if (!current || now - current.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(key, { windowStartedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

async function getCuratedVenues(
  location: Coordinates,
  radiusMiles: number,
) {
  const bars = await db.select().from(barsTable);
  const nearby = bars
    .filter(
      (bar) =>
        typeof bar.latitude === "number" &&
        typeof bar.longitude === "number" &&
        bar.locationVerifiedAt,
    )
    .map((bar) => ({
      bar,
      distanceMiles: distanceMiles(location, {
        latitude: bar.latitude as number,
        longitude: bar.longitude as number,
      }),
    }))
    .filter((entry) => entry.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, MAX_RESULTS);

  return Promise.all(nearby.map((entry) => barWithStats(entry.bar)));
}

async function searchGoogleNearby(
  location: Coordinates,
  radiusMiles: number,
): Promise<DiscoveredVenue[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(GOOGLE_NEARBY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.primaryType",
      },
      body: JSON.stringify({
        includedTypes: ["bar", "night_club"],
        maxResultCount: MAX_RESULTS,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: location,
            radius: radiusMiles * 1609.344,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Google Places returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: Coordinates;
        googleMapsUri?: string;
        primaryType?: string;
      }>;
    };

    return (payload.places ?? [])
      .filter(
        (place) =>
          typeof place.id === "string" &&
          typeof place.displayName?.text === "string" &&
          typeof place.location?.latitude === "number" &&
          typeof place.location?.longitude === "number",
      )
      .map((place) => ({
        providerId: place.id as string,
        name: place.displayName?.text as string,
        address: place.formattedAddress ?? null,
        latitude: place.location?.latitude as number,
        longitude: place.location?.longitude as number,
        distanceMiles: distanceMiles(location, {
          latitude: place.location?.latitude as number,
          longitude: place.location?.longitude as number,
        }),
        googleMapsUri: place.googleMapsUri ?? null,
        primaryType: place.primaryType ?? null,
      }))
      .filter((place) => place.distanceMiles <= radiusMiles)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, MAX_RESULTS);
  } finally {
    clearTimeout(timeout);
  }
}

router.get("/venues/nearby", async (req, res): Promise<void> => {
  if (isRateLimited(req)) {
    res.status(429).json({ error: "Nearby venue search is temporarily rate limited. Try again shortly." });
    return;
  }

  const location = parseCoordinates(req);
  if (!location) {
    res.status(400).json({ error: "Valid latitude and longitude are required." });
    return;
  }

  const radiusMiles = parseRadiusMiles(req);
  const curated = await getCuratedVenues(location, radiusMiles);
  const curatedKeys = curated.map((bar) => ({
    name: normalize(bar.name),
    address: normalize(bar.address),
    latitude: bar.latitude,
    longitude: bar.longitude,
  }));
  const cacheKey = `${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}:${radiusMiles}`;
  const cached = discoveryCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    res.json({
      curated,
      discovered: cached.venues.filter(
        (venue) =>
          !curatedKeys.some(
            (bar) =>
              (bar.name && bar.name === normalize(venue.name)) ||
              (bar.address && bar.address === normalize(venue.address)),
          ),
      ),
      radiusMiles,
      liveSearchStatus: "available",
      liveSearchMessage: null,
      attribution: {
        label: "Powered by Google Maps",
        url: "https://maps.google.com",
      },
    });
    return;
  }

  try {
    const discovered = await searchGoogleNearby(location, radiusMiles);
    discoveryCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      venues: discovered,
    });
    res.json({
      curated,
      discovered: discovered.filter(
        (venue) =>
          !curatedKeys.some(
            (bar) =>
              (bar.name && bar.name === normalize(venue.name)) ||
              (bar.address && bar.address === normalize(venue.address)),
          ),
      ),
      radiusMiles,
      liveSearchStatus: "available",
      liveSearchMessage: null,
      attribution: {
        label: "Powered by Google Maps",
        url: "https://maps.google.com",
      },
    });
  } catch (error) {
    console.error("Nearby Google Places search failed:", error instanceof Error ? error.message : error);
    res.json({
      curated,
      discovered: [],
      radiusMiles,
      liveSearchStatus: "error",
      liveSearchMessage: "Live venue discovery is temporarily unavailable. Your curated venues are still shown.",
      attribution: {
        label: "Powered by Google Maps",
        url: "https://maps.google.com",
      },
    });
  }
});

export default router;