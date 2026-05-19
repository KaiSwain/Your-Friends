import {
  formatCityLocationLabel,
  formatGeocodedPlaceName,
  formatPlaceLocationLabel,
  formatStateLocationLabel,
  normalizeLocationName,
  readCoordinatesFromExif,
} from '../memoryLocationFormat';

describe('normalizeLocationName', () => {
  it('trims and returns null for empty values', () => {
    expect(normalizeLocationName('')).toBeNull();
    expect(normalizeLocationName('   ')).toBeNull();
    expect(normalizeLocationName(null)).toBeNull();
  });

  it('caps long place names', () => {
    const longName = 'A'.repeat(120);
    expect(normalizeLocationName(longName)).toHaveLength(80);
  });

  it('keeps a trimmed place name', () => {
    expect(normalizeLocationName('  Echo Park Lake  ')).toBe('Echo Park Lake');
  });
});

describe('formatted location labels', () => {
  it('builds city and place labels with state context', () => {
    expect(formatCityLocationLabel('Franklin', 'Tennessee')).toBe('Franklin, Tennessee');
    expect(formatPlaceLocationLabel('Starbucks', 'Franklin', 'Tennessee')).toBe('Starbucks, Franklin, Tennessee');
    expect(formatStateLocationLabel('Tennessee')).toBe('Tennessee');
  });
});

describe('formatGeocodedPlaceName', () => {
  it('prefers venue names over street addresses', () => {
    expect(formatGeocodedPlaceName({
      name: 'Echo Park Lake',
      street: '751 N Echo Park Ave',
      city: 'Los Angeles',
      region: 'CA',
    })).toBe('Echo Park Lake');
  });

  it('falls back to neighborhood or city for street-like names', () => {
    expect(formatGeocodedPlaceName({
      name: '123 Main Street',
      street: 'Main Street',
      city: 'Los Angeles',
      region: 'CA',
      district: 'Echo Park',
    })).toBe('Echo Park');
  });
});

describe('readCoordinatesFromExif', () => {
  it('reads direct latitude and longitude fields', () => {
    expect(readCoordinatesFromExif({ latitude: 34.07, longitude: -118.25 })).toEqual({
      latitude: 34.07,
      longitude: -118.25,
    });
  });

  it('reads nested GPS exif fields', () => {
    expect(readCoordinatesFromExif({
      GPS: {
        Latitude: 34.07,
        Longitude: 118.25,
        LatitudeRef: 'N',
        LongitudeRef: 'W',
      },
    })).toEqual({
      latitude: 34.07,
      longitude: -118.25,
    });
  });
});
