const MAX_LOCATION_NAME_LENGTH = 80;

export function normalizeLocationName(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_LOCATION_NAME_LENGTH);
}

export function formatStateLocationLabel(state: string): string | null {
  return normalizeLocationName(state);
}

export function formatCityLocationLabel(city: string, state: string | null): string | null {
  const parts = [city.trim(), state?.trim()].filter(Boolean);
  return normalizeLocationName(parts.join(', '));
}

export function formatPlaceLocationLabel(place: string, city: string | null, state: string | null): string | null {
  const parts = [place.trim(), city?.trim(), state?.trim()].filter(Boolean);
  return normalizeLocationName(parts.join(', '));
}

export function formatGeocodedPlaceName(place: {
  name?: string | null;
  street?: string | null;
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
  region?: string | null;
}): string | null {
  const venue = place.name?.trim();
  if (venue && !looksLikeStreetAddress(venue)) {
    return normalizeLocationName(venue);
  }

  const neighborhood = place.district ?? place.subregion ?? place.street;
  if (neighborhood && !looksLikeStreetAddress(neighborhood)) {
    return normalizeLocationName(neighborhood);
  }

  return normalizeLocationName(place.city ?? place.region ?? null);
}

export function readCoordinatesFromExif(exif: Record<string, unknown> | null | undefined): { latitude: number; longitude: number } | null {
  if (!exif) return null;

  const directLat = readNumber(exif.latitude ?? exif.Latitude);
  const directLng = readNumber(exif.longitude ?? exif.Longitude);
  if (directLat != null && directLng != null) {
    return { latitude: directLat, longitude: directLng };
  }

  const gps = exif.GPS;
  if (gps && typeof gps === 'object') {
    const gpsRecord = gps as Record<string, unknown>;
    const latitude = parseExifCoordinate(gpsRecord.Latitude, gpsRecord.LatitudeRef);
    const longitude = parseExifCoordinate(gpsRecord.Longitude, gpsRecord.LongitudeRef);
    if (latitude != null && longitude != null) {
      return { latitude, longitude };
    }
  }

  return null;
}

function parseExifCoordinate(value: unknown, ref: unknown): number | null {
  const numeric = readNumber(value);
  if (numeric == null) return null;
  const direction = typeof ref === 'string' ? ref.trim().toUpperCase() : '';
  if (direction === 'S' || direction === 'W') return -Math.abs(numeric);
  return numeric;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function looksLikeStreetAddress(value: string): boolean {
  return /^\d+\s/.test(value) || /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way)\b/i.test(value);
}
