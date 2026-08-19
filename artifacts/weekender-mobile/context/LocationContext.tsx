import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { Coordinates } from '@/utils/location';

type LocationStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable';

type LocationContextValue = {
  coordinates: Coordinates | null;
  status: LocationStatus;
  error: string | null;
  canAskAgain: boolean;
  requestLocation: () => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [permission, requestPermission] = Location.useForegroundPermissions();

  const requestLocation = useCallback(() => {
    setStatus('requesting');
    setError(null);

    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setStatus('unavailable');
        setError('Location is not supported by this browser.');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoordinates({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setStatus('ready');
        },
        (locationError) => {
          setCanAskAgain(true);
          setStatus('denied');
          setError(locationError.message || 'Location access was not granted.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
      return;
    }

    void (async () => {
      const activePermission =
        permission?.granted ? permission : await requestPermission();

      if (!activePermission.granted) {
        setCanAskAgain(activePermission.canAskAgain);
        setStatus('denied');
        setError('Turn on location to see the closest spots around you.');
        return;
      }

      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setStatus('ready');
      } catch {
        setStatus('unavailable');
        setError('We could not get a location fix. Try again outdoors or check your device settings.');
      }
    })();
  }, [permission, requestPermission]);

  const value = useMemo(
    () => ({ coordinates, status, error, canAskAgain, requestLocation }),
    [coordinates, status, error, canAskAgain, requestLocation],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useDeviceLocation(): LocationContextValue {
  const value = useContext(LocationContext);
  if (!value) {
    throw new Error('useDeviceLocation must be used inside LocationProvider.');
  }
  return value;
}