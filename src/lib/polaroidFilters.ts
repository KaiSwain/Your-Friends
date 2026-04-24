/** Polaroid-style photo filters applied as tinted overlays on the image. */

export interface PolaroidFilter {
  /** Unique key stored in the database. */
  key: string;
  /** Display label in the picker. */
  label: string;
  /** Overlay color (with alpha for blending). null = no overlay. */
  overlay: string | null;
  /** Optional second overlay for dual-tone effects. */
  overlay2?: string | null;
  /** Swatch preview color for the picker. */
  swatch: string;
}

export const polaroidFilters: PolaroidFilter[] = [
  { key: 'none', label: 'None', overlay: null, swatch: 'transparent' },
  { key: 'vintage', label: 'Vintage', overlay: 'rgba(180, 140, 80, 0.25)', swatch: '#B48C50' },
  { key: 'warm', label: 'Warm', overlay: 'rgba(255, 160, 60, 0.18)', swatch: '#FFA03C' },
  { key: 'cool', label: 'Cool', overlay: 'rgba(80, 140, 220, 0.2)', swatch: '#508CDC' },
  { key: 'faded', label: 'Faded', overlay: 'rgba(200, 200, 200, 0.3)', swatch: '#C8C8C8' },
  { key: 'rose', label: 'Rosé', overlay: 'rgba(220, 120, 150, 0.18)', swatch: '#DC7896' },
  { key: 'noir', label: 'Noir', overlay: 'rgba(0, 0, 0, 0.35)', overlay2: 'rgba(255, 255, 255, 0.05)', swatch: '#333333' },
  { key: 'golden', label: 'Golden', overlay: 'rgba(255, 200, 50, 0.2)', swatch: '#FFC832' },
  { key: 'forest', label: 'Forest', overlay: 'rgba(60, 120, 60, 0.18)', swatch: '#3C783C' },
];

export type PolaroidFilterKey = typeof polaroidFilters[number]['key'];

export function getFilterByKey(key: string | null | undefined): PolaroidFilter {
  if (!key || key === 'none') return polaroidFilters[0];
  return polaroidFilters.find((f) => f.key === key) ?? polaroidFilters[0];
}
