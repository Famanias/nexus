'use client';

import { useState, useCallback } from 'react';
import { LocationState } from '@/types';

export function useLocation() {
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
  });

  const getLocation = useCallback((): Promise<LocationState> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const state: LocationState = {
          latitude: null,
          longitude: null,
          accuracy: null,
          error: 'Geolocation is not supported by your browser.',
          loading: false,
        };
        setLocation(state);
        resolve(state);
        return;
      }

      setLocation((prev) => ({ ...prev, loading: true, error: null }));

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const state: LocationState = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            error: null,
            loading: false,
          };
          setLocation(state);
          resolve(state);
        },
        (err) => {
          const state: LocationState = {
            latitude: null,
            longitude: null,
            accuracy: null,
            error: `Location error: ${err.message}`,
            loading: false,
          };
          setLocation(state);
          resolve(state);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  return { location, getLocation };
}
