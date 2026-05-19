import * as Location from 'expo-location';

import { formatGeocodedPlaceName, normalizeLocationName, readCoordinatesFromExif } from './memoryLocationFormat';

export type MemoryLocationDetectStatus = 'idle' | 'loading' | 'denied' | 'unavailable' | 'ready';

export { formatGeocodedPlaceName, normalizeLocationName, readCoordinatesFromExif };

export async function getPlaceNameFromCoordinates(latitude: number, longitude: number): Promise<string | null> {
  const results = await Location.reverseGeocodeAsync({ latitude, longitude });
  const place = results[0];
  return place ? formatGeocodedPlaceName(place) : null;
}

export async function getCurrentPlaceName(): Promise<{ placeName: string | null; status: MemoryLocationDetectStatus }> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    return { placeName: null, status: 'denied' };
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const placeName = await getPlaceNameFromCoordinates(position.coords.latitude, position.coords.longitude);
  return {
    placeName,
    status: placeName ? 'ready' : 'unavailable',
  };
}
