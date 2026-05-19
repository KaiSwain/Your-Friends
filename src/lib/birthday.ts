export interface BirthdayParts {
  month: number;
  day: number;
  year: number;
}

export function parseBirthdayInput(input: string) {
  const trimmed = input.trim();
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(year)) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (date.getTime() > Date.now()) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatBirthdayForInput(value: string | null | undefined) {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';
  return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
}

export function parseBirthdayParts(value: string | null | undefined): BirthdayParts | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  return birthdayPartsToIso(parts) ? parts : null;
}

export function getDefaultBirthdayParts(): BirthdayParts {
  return { month: 1, day: 1, year: new Date().getFullYear() - 18 };
}

export function getDefaultBirthdayIso() {
  return birthdayPartsToIso(getDefaultBirthdayParts())!;
}

export function birthdayPartsToIso(parts: BirthdayParts) {
  const clamped = clampBirthdayParts(parts);
  const date = new Date(clamped.year, clamped.month - 1, clamped.day);
  if (date.getFullYear() !== clamped.year || date.getMonth() !== clamped.month - 1 || date.getDate() !== clamped.day) {
    return null;
  }
  if (date.getTime() > Date.now()) return null;
  return `${clamped.year}-${String(clamped.month).padStart(2, '0')}-${String(clamped.day).padStart(2, '0')}`;
}

export function clampBirthdayParts(parts: BirthdayParts): BirthdayParts {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const year = clamp(Math.round(parts.year), 1900, currentYear);
  const month = clamp(Math.round(parts.month), 1, year === currentYear ? currentMonth : 12);
  const dayMax = year === currentYear && month === currentMonth
    ? currentDay
    : getDaysInMonth(year, month);
  const day = clamp(Math.round(parts.day), 1, dayMax);
  return { month, day, year };
}

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
