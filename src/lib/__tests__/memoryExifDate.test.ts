import { extractAssetMemoryDateKey, parseExifDateTimeToDateKey } from '../memoryExifDate';

const NOW = new Date(2026, 5, 21); // June 21, 2026 (local)

describe('parseExifDateTimeToDateKey', () => {
  it('parses standard EXIF datetime format', () => {
    expect(parseExifDateTimeToDateKey('2021:07:04 13:45:30')).toBe('2021-07-04');
  });

  it('parses an EXIF date with no time component', () => {
    expect(parseExifDateTimeToDateKey('2019:12:25')).toBe('2019-12-25');
  });

  it('returns null for empty or malformed values', () => {
    expect(parseExifDateTimeToDateKey('')).toBeNull();
    expect(parseExifDateTimeToDateKey('not a date')).toBeNull();
  });

  it('rejects an impossible calendar date', () => {
    expect(parseExifDateTimeToDateKey('2021:02:30 00:00:00')).toBeNull();
  });
});

describe('extractAssetMemoryDateKey', () => {
  it('reads DateTimeOriginal from a flat exif blob', () => {
    const asset = { exif: { DateTimeOriginal: '2020:01:15 09:00:00' } };
    expect(extractAssetMemoryDateKey(asset, NOW)).toBe('2020-01-15');
  });

  it('falls back through preferred tags', () => {
    const asset = { exif: { DateTime: '2018:03:09 18:00:00' } };
    expect(extractAssetMemoryDateKey(asset, NOW)).toBe('2018-03-09');
  });

  it('reads from the nested iOS {Exif} group', () => {
    const asset = { exif: { '{Exif}': { DateTimeOriginal: '2017:11:02 07:30:00' } } };
    expect(extractAssetMemoryDateKey(asset, NOW)).toBe('2017-11-02');
  });

  it('returns null when there is no exif date', () => {
    expect(extractAssetMemoryDateKey({ exif: { Make: 'Apple' } }, NOW)).toBeNull();
    expect(extractAssetMemoryDateKey({ exif: null }, NOW)).toBeNull();
    expect(extractAssetMemoryDateKey(null, NOW)).toBeNull();
  });

  it('rejects future-dated metadata', () => {
    const asset = { exif: { DateTimeOriginal: '2030:01:01 00:00:00' } };
    expect(extractAssetMemoryDateKey(asset, NOW)).toBeNull();
  });

  it('prefers DateTimeOriginal over DateTime when both exist', () => {
    const asset = { exif: { DateTimeOriginal: '2020:01:15 09:00:00', DateTime: '2026:06:20 09:00:00' } };
    expect(extractAssetMemoryDateKey(asset, NOW)).toBe('2020-01-15');
  });
});
