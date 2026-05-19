jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getLastKnownPositionAsync: jest.fn(async () => ({
    coords: { latitude: 35.92, longitude: -86.87 },
  })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 35.92, longitude: -86.87 },
  })),
  reverseGeocodeAsync: jest.fn(async () => []),
}));

import * as Location from 'expo-location';

import {
  formatCityLocationLabel,
  formatPlaceLocationLabel,
  formatStateLocationLabel,
} from '../memoryLocationFormat';
import { getNearbyLocationSuggestions, searchLocationSuggestions } from '../memoryLocationSearch';

describe('location label formatting', () => {
  it('formats state, city, and place labels', () => {
    expect(formatStateLocationLabel('Tennessee')).toBe('Tennessee');
    expect(formatCityLocationLabel('Franklin', 'Tennessee')).toBe('Franklin, Tennessee');
    expect(formatPlaceLocationLabel('Starbucks', 'Franklin', 'Tennessee')).toBe('Starbucks, Franklin, Tennessee');
  });
});

describe('getNearbyLocationSuggestions', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
      { region: 'Tennessee', city: 'Franklin' },
    ]);
  });

  it('orders nearby places closest-first before city and state', async () => {
    (global.fetch as jest.Mock).mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        elements: [
          {
            lat: 35.95,
            lon: -86.87,
            tags: { name: 'Far Cafe', amenity: 'cafe' },
          },
          {
            lat: 35.9205,
            lon: -86.8702,
            tags: { name: 'Near Cafe', amenity: 'cafe' },
          },
        ],
      }),
    }));

    const result = await getNearbyLocationSuggestions();

    expect(result.status).toBe('ready');
    expect(result.suggestions.map((suggestion) => suggestion.label)).toEqual([
      'Near Cafe, Franklin, Tennessee',
      'Far Cafe, Franklin, Tennessee',
      'Franklin, Tennessee',
      'Tennessee',
    ]);
    expect(result.suggestions.map((suggestion) => suggestion.kind)).toEqual([
      'place',
      'place',
      'city',
      'state',
    ]);
  });
});

describe('searchLocationSuggestions', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('maps nominatim results into formatted labels', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (String(url).includes('nominatim')) {
        return {
          ok: true,
          json: async () => [
            {
              place_id: 1,
              name: 'Tennessee',
              type: 'administrative',
              class: 'boundary',
              address: { state: 'Tennessee', country: 'United States' },
            },
            {
              place_id: 2,
              name: 'Franklin',
              type: 'city',
              class: 'place',
              address: { city: 'Franklin', state: 'Tennessee', country: 'United States' },
            },
            {
              place_id: 3,
              name: 'Starbucks',
              type: 'cafe',
              class: 'amenity',
              address: { city: 'Franklin', state: 'Tennessee', country: 'United States' },
            },
          ],
        };
      }
      return { ok: true, json: async () => ({ features: [] }) };
    });

    const suggestions = await searchLocationSuggestions('franklin');

    expect(suggestions).toEqual([
      {
        id: 'search_state_1',
        label: 'Tennessee',
        kind: 'state',
        detail: null,
      },
      {
        id: 'search_city_2',
        label: 'Franklin, Tennessee',
        kind: 'city',
        detail: null,
      },
      {
        id: 'search_place_3',
        label: 'Starbucks, Franklin, Tennessee',
        kind: 'place',
        detail: null,
      },
    ]);
  });

  it('returns an empty list for short queries', async () => {
    const suggestions = await searchLocationSuggestions('a');
    expect(suggestions).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
