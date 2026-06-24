// Resolve the capture date and location of a photo picked from the library.
//
// iOS's privacy-friendly photo picker (PHPicker) strips EXIF GPS — and often
// the original date too — from the image it hands back, so reading asset.exif
// alone never yields a location on iOS. The reliable source is the photo's
// underlying library asset, which expo-media-library can look up by assetId
// (with photo-library permission). We try the library first and fall back to
// whatever EXIF survived, so this still degrades gracefully when permission is
// denied or the asset can't be resolved.

import * as MediaLibrary from 'expo-media-library';

import { extractAssetMemoryDateKey } from './memoryExifDate';
import { extractAssetGpsCoords, type GpsCoords } from './memoryExifLocation';

export interface ImportedAssetMetadata {
  dateKey: string | null;
  coords: GpsCoords | null;
}

interface PickedAssetLike {
  assetId?: string | null;
  exif?: Record<string, unknown> | null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toDateKey(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

async function ensureLibraryPermission(): Promise<boolean> {
  try {
    const current = await MediaLibrary.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await MediaLibrary.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

export async function resolveImportedAssetMetadata(
  asset: PickedAssetLike | null | undefined,
  now: Date = new Date(),
): Promise<ImportedAssetMetadata> {
  // Whatever EXIF survived is the baseline (works with no permission).
  let dateKey = extractAssetMemoryDateKey(asset, now);
  let coords = extractAssetGpsCoords(asset);

  const assetId = typeof asset?.assetId === 'string' ? asset.assetId : null;
  if (assetId && (!dateKey || !coords)) {
    const granted = await ensureLibraryPermission();
    if (granted) {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(assetId);
        if (!coords && info.location) {
          const { latitude, longitude } = info.location;
          if (
            Number.isFinite(latitude) && Number.isFinite(longitude)
            && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
            && !(latitude === 0 && longitude === 0)
          ) {
            coords = { latitude, longitude };
          }
        }
        if (!dateKey && typeof info.creationTime === 'number' && info.creationTime > 0) {
          const candidate = toDateKey(new Date(info.creationTime));
          // Reject future dates as bogus metadata, mirroring the EXIF path.
          if (candidate && candidate <= (toDateKey(now) ?? candidate)) {
            dateKey = candidate;
          }
        }
      } catch {
        // Asset not resolvable (e.g. limited access) — keep EXIF fallback.
      }
    }
  }

  return { dateKey, coords };
}
