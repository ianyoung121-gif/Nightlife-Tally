import { useState, useEffect, useCallback } from "react";

export type UserLocation = {
  latitude: number;
  longitude: number;
};

export type LocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "granted"; location: UserLocation }
  | { status: "denied"; error: string };

/** Returns the user's GPS coordinates via the browser Geolocation API. */
export function useUserLocation() {
  const [state, setState] = useState<LocationState>({ status: "idle" });

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ status: "denied", error: "Geolocation is not supported by your browser." });
      return;
    }
    setState({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          status: "granted",
          location: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        });
      },
      (err) => {
        setState({ status: "denied", error: err.message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Auto-request on mount so the app feels seamless on mobile
  useEffect(() => {
    request();
  }, [request]);

  return { state, request };
}

/** Haversine distance in miles between two lat/lng points. */
export function distanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
