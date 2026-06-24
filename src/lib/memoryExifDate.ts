// Pull the original capture date out of a picked photo's metadata so memories
// imported from the camera roll can be dated to when the photo was actually
// taken (instead of today). Best-effort: returns null when no usable date is
// present, in which case callers should fall back to today.

// EXIF stores timestamps as "YYYY:MM:DD HH:MM:SS". These are the tags most
// likely to hold the real capture moment, in order of preference.
const EXIF_DATE_TAGS = ['DateTimeOriginal', 'DateTimeDigitized', 'DateTime'];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Parse an EXIF datetime string ("YYYY:MM:DD HH:MM:SS") into a YYYY-MM-DD key.
// Falls back to Date parsing for ISO-ish strings. Returns null if invalid.
export function parseExifDateTimeToDateKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = /^(\d{4}):(\d{2}):(\d{2})/.exec(trimmed);
  if (match) {
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return `${yearText}-${monthText}-${dayText}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
}

// Read the best available EXIF date string from a picker asset's exif blob,
// handling both the flattened shape and iOS's nested "{Exif}"/"{TIFF}" groups.
function readExifDateString(exif: Record<string, unknown> | null | undefined): string | null {
  if (!exif) return null;
  const groups: Record<string, unknown>[] = [exif];
  for (const groupKey of ['{Exif}', '{TIFF}']) {
    const group = exif[groupKey];
    if (group && typeof group === 'object') groups.push(group as Record<string, unknown>);
  }
  for (const group of groups) {
    for (const tag of EXIF_DATE_TAGS) {
      const value = group[tag];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return null;
}

export interface ExifBearingAsset {
  exif?: Record<string, unknown> | null;
}

// Extract a usable memory date key from a picked asset, or null. Dates in the
// future are rejected as bogus metadata so we never date a memory ahead of now.
export function extractAssetMemoryDateKey(
  asset: ExifBearingAsset | null | undefined,
  now: Date = new Date(),
): string | null {
  const raw = readExifDateString(asset?.exif);
  if (!raw) return null;
  const key = parseExifDateTimeToDateKey(raw);
  if (!key) return null;
  if (key > toDateKey(now)) return null;
  return key;
}
