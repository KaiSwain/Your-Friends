/**
 * Return '#000000' or '#FFFFFF' depending on which contrasts better
 * against the given hex background color.
 */
export function contrastText(hex: string | null | undefined): '#000000' | '#FFFFFF' {
  if (!hex) return '#FFFFFF'; // dark-mode default
  const raw = hex.replace('#', '');
  const r = parseInt(raw.substring(0, 2), 16);
  const g = parseInt(raw.substring(2, 4), 16);
  const b = parseInt(raw.substring(4, 6), 16);
  // Relative luminance (sRGB)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Return a lighter/darker muted variant for secondary text.
 */
export function contrastTextSoft(hex: string | null | undefined): string {
  return contrastText(hex) === '#000000' ? '#444444' : '#BBBBBB';
}

/**
 * Return an accent-like color that works on the given background.
 * On light backgrounds, use a darker accent; on dark, use the normal accent.
 */
export function contrastAccent(hex: string | null | undefined, accent: string): string {
  if (!hex) return accent;
  const raw = hex.replace('#', '');
  const r = parseInt(raw.substring(0, 2), 16);
  const g = parseInt(raw.substring(2, 4), 16);
  const b = parseInt(raw.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.5) {
    // Darken accent for light backgrounds
    const ar = parseInt(accent.replace('#', '').substring(0, 2), 16);
    const ag = parseInt(accent.replace('#', '').substring(2, 4), 16);
    const ab = parseInt(accent.replace('#', '').substring(4, 6), 16);
    const dr = Math.round(ar * 0.6);
    const dg = Math.round(ag * 0.6);
    const db = Math.round(ab * 0.6);
    return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
  }
  return accent;
}
