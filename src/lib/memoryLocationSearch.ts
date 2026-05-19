import * as Location from 'expo-location';

import {
  formatCityLocationLabel,
  formatPlaceLocationLabel,
  formatStateLocationLabel,
  normalizeLocationName,
} from './memoryLocationFormat';

export type MemoryLocationSuggestionKind = 'state' | 'city' | 'place';

export interface MemoryLocationSuggestion {
  id: string;
  label: string;
  kind: MemoryLocationSuggestionKind;
  detail: string | null;
}

export interface LocationSearchContext {
  latitude: number;
  longitude: number;
}

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const SEARCH_LIMIT = 8;
const NEARBY_VENUE_LIMIT = 10;
const NEARBY_RADIUS_METERS = 2500;

export type NearbyLocationSuggestionsResult =
  | { status: 'ready'; suggestions: MemoryLocationSuggestion[]; context: LocationSearchContext }
  | { status: 'denied'; suggestions: []; context: null }
  | { status: 'unavailable'; suggestions: []; context: null };

export async function getNearbyLocationSuggestions(): Promise<NearbyLocationSuggestionsResult> {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted' && permission.status !== 'denied') {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== 'granted') {
    return { status: 'denied', suggestions: [], context: null };
  }

  const lastKnown = await Location.getLastKnownPositionAsync();
  const position = lastKnown ?? await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const context: LocationSearchContext = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };

  const results = await Location.reverseGeocodeAsync(context);
  if (!results.length) {
    return { status: 'unavailable', suggestions: [], context: null };
  }

  const primary = results[0];
  const state = primary.region?.trim() ?? null;
  const city = primary.city?.trim() ?? primary.subregion?.trim() ?? null;

  const suggestions: MemoryLocationSuggestion[] = [];
  const seen = new Set<string>();

  const pushSuggestion = (kind: MemoryLocationSuggestionKind, label: string | null | undefined) => {
    const normalized = normalizeLocationName(label);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({
      id: `nearby_${kind}_${key}`,
      label: normalized,
      kind,
      detail: null,
    });
  };

  const venues = await fetchNearbyVenues(context.latitude, context.longitude, city, state);
  for (const venue of venues) {
    pushSuggestion('place', venue);
  }
  if (city) {
    pushSuggestion('city', formatCityLocationLabel(city, state));
  }
  if (state) {
    pushSuggestion('state', formatStateLocationLabel(state));
  }

  if (suggestions.length === 0) {
    return { status: 'unavailable', suggestions: [], context: null };
  }

  return { status: 'ready', suggestions, context };
}

export async function searchLocationSuggestions(
  query: string,
  context?: LocationSearchContext | null,
): Promise<MemoryLocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const photonResults = context
    ? await searchPhotonSuggestions(trimmed, context)
    : [];
  const nominatimResults = await searchNominatimSuggestions(trimmed);

  const suggestions: MemoryLocationSuggestion[] = [];
  const seen = new Set<string>();

  for (const suggestion of [...photonResults, ...nominatimResults]) {
    const key = suggestion.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(suggestion);
    if (suggestions.length >= SEARCH_LIMIT) break;
  }

  return suggestions;
}

async function fetchNearbyVenues(
  latitude: number,
  longitude: number,
  city: string | null,
  state: string | null,
): Promise<string[]> {
  const query = `[out:json][timeout:12];
(
  node["name"]["amenity"~"^(cafe|restaurant|fast_food|coffee_shop|bar|ice_cream|bakery)$"](around:${NEARBY_RADIUS_METERS},${latitude},${longitude});
);
out body ${NEARBY_VENUE_LIMIT + 10};`;

  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!response.ok) return [];

    const payload = await response.json();
    const elements = Array.isArray(payload?.elements) ? payload.elements : [];
    const ranked: { label: string; distance: number }[] = [];
    const seen = new Set<string>();

    for (const element of elements) {
      const tags = element?.tags;
      if (!tags || typeof tags !== 'object') continue;
      const name = readString((tags as Record<string, unknown>).name);
      if (!name || name.length < 3 || isGenericVenueName(name)) continue;
      const label = formatPlaceLocationLabel(name, city, state);
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;

      const nodeLat = readNumber(element?.lat);
      const nodeLon = readNumber(element?.lon);
      if (nodeLat == null || nodeLon == null) continue;

      seen.add(key);
      ranked.push({
        label,
        distance: distanceMeters(latitude, longitude, nodeLat, nodeLon),
      });
    }

    ranked.sort((a, b) => a.distance - b.distance);
    return ranked.slice(0, NEARBY_VENUE_LIMIT).map((entry) => entry.label);
  } catch {
    return [];
  }
}

async function searchPhotonSuggestions(query: string, context: LocationSearchContext): Promise<MemoryLocationSuggestion[]> {
  const url = new URL(PHOTON_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('lat', String(context.latitude));
  url.searchParams.set('lon', String(context.longitude));
  url.searchParams.set('limit', String(SEARCH_LIMIT));

  try {
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!response.ok) return [];

    const payload = await response.json();
    const features = Array.isArray(payload?.features) ? payload.features : [];
    const suggestions: MemoryLocationSuggestion[] = [];

    for (const feature of features) {
      const suggestion = mapPhotonFeature(feature);
      if (suggestion) suggestions.push(suggestion);
    }

    return suggestions;
  } catch {
    return [];
  }
}

async function searchNominatimSuggestions(query: string): Promise<MemoryLocationSuggestion[]> {
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(SEARCH_LIMIT));

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'YourFriends/1.0',
      },
    });
    if (!response.ok) return [];

    const payload = await response.json();
    if (!Array.isArray(payload)) return [];

    const suggestions: MemoryLocationSuggestion[] = [];
    for (const item of payload) {
      const suggestion = mapNominatimResult(item);
      if (suggestion) suggestions.push(suggestion);
    }
    return suggestions;
  } catch {
    return [];
  }
}

function mapPhotonFeature(feature: Record<string, unknown>): MemoryLocationSuggestion | null {
  const properties = feature.properties;
  if (!properties || typeof properties !== 'object') return null;

  const props = properties as Record<string, unknown>;
  const state = readString(props.state);
  const city = readString(props.city) ?? readString(props.county);
  const name = readString(props.name);
  if (!name) return null;

  const osmValue = readString(props.osm_value)?.toLowerCase() ?? '';
  const isCity = ['city', 'town', 'village', 'hamlet', 'municipality'].includes(osmValue);
  const isState = osmValue === 'state';

  if (isState && state) {
    const label = formatStateLocationLabel(state);
    if (!label) return null;
    return { id: `photon_state_${label}`, label, kind: 'state', detail: null };
  }

  if (isCity && city) {
    const label = formatCityLocationLabel(city, state);
    if (!label) return null;
    return { id: `photon_city_${label}`, label, kind: 'city', detail: null };
  }

  const label = formatPlaceLocationLabel(name, city, state);
  if (!label) return null;
  return { id: `photon_place_${label}`, label, kind: 'place', detail: null };
}

function mapNominatimResult(item: Record<string, unknown>): MemoryLocationSuggestion | null {
  const address = (item.address && typeof item.address === 'object')
    ? item.address as Record<string, unknown>
    : {};

  const state = readString(address.state);
  const city = readString(address.city) ?? readString(address.town) ?? readString(address.village);
  const venueName = readString(item.name)
    ?? readString(address.amenity)
    ?? readString(address.shop)
    ?? readString(address.leisure);

  const type = readString(item.type)?.toLowerCase() ?? '';
  const klass = readString(item.class)?.toLowerCase() ?? '';

  if ((klass === 'boundary' && type === 'administrative') || type === 'state') {
    if (!state) return null;
    const label = formatStateLocationLabel(state);
    if (!label) return null;
    return { id: `search_state_${String(item.place_id ?? label)}`, label, kind: 'state', detail: null };
  }

  if (['city', 'town', 'village', 'municipality', 'hamlet'].includes(type) && city) {
    const label = formatCityLocationLabel(city, state);
    if (!label) return null;
    return { id: `search_city_${String(item.place_id ?? label)}`, label, kind: 'city', detail: null };
  }

  if (!venueName) return null;
  const label = formatPlaceLocationLabel(venueName, city, state);
  if (!label) return null;
  return { id: `search_place_${String(item.place_id ?? label)}`, label, kind: 'place', detail: null };
}

function isGenericVenueName(name: string): boolean {
  return /^(restaurant|cafe|coffee|shop|store|fast food|food)$/i.test(name.trim());
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
