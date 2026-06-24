// Pull GPS coordinates out of a picked photo's EXIF metadata so memories
// imported from the camera roll can be auto-tagged with where the photo was
// taken. Best-effort: returns null when there's no usable location data, in
// which case callers should leave the location untouched.

export interface GpsCoords {
  latitude: number;
  longitude: number;
}

export interface GpsBearingAsset {
  exif?: Record<string, unknown> | null;
}

// EXIF can express coordinates as a plain decimal degree number or as a
// [degrees, minutes, seconds] tuple. Normalize both into decimal degrees.
function toDecimalDegrees(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.abs(value);
  if (Array.isArray(value) && value.length >= 1) {
    const [deg = 0, min = 0, sec = 0] = value.map((part) => (typeof part === 'number' ? part : Number(part)));
    if ([deg, min, sec].some((part) => !Number.isFinite(part))) return null;
    return Math.abs(deg) + Math.abs(min) / 60 + Math.abs(sec) / 3600;
  }
  return null;
}

function applyHemisphere(magnitude: number, ref: unknown, negativeRef: string): number {
  const refText = typeof ref === 'string' ? ref.trim().toUpperCase() : '';
  return refText === negativeRef ? -magnitude : magnitude;
}

function readGpsGroup(exif: Record<string, unknown>): Record<string, unknown> {
  // iOS nests GPS data under "{GPS}"; Android/flattened blobs keep it inline.
  const nested = exif['{GPS}'];
  return nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : exif;
}

// Extract decimal-degree coordinates from a picked asset, or null. Coordinates
// that fall outside valid ranges (or sit exactly at 0,0) are rejected as bogus.
export function extractAssetGpsCoords(asset: GpsBearingAsset | null | undefined): GpsCoords | null {
  const exif = asset?.exif;
  if (!exif || typeof exif !== 'object') return null;

  const gps = readGpsGroup(exif as Record<string, unknown>);

  const latMagnitude = toDecimalDegrees(gps.Latitude ?? gps.GPSLatitude);
  const lonMagnitude = toDecimalDegrees(gps.Longitude ?? gps.GPSLongitude);
  if (latMagnitude == null || lonMagnitude == null) return null;

  const latitude = applyHemisphere(latMagnitude, gps.LatitudeRef ?? gps.GPSLatitudeRef, 'S');
  const longitude = applyHemisphere(lonMagnitude, gps.LongitudeRef ?? gps.GPSLongitudeRef, 'W');

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (latitude === 0 && longitude === 0) return null;

  return { latitude, longitude };
}
