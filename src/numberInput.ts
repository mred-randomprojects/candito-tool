/**
 * Parsing for mobile-friendly numeric text inputs (type="text" with
 * inputMode) — tolerant of a decimal comma, since some phone keyboards
 * only offer one on the decimal pad.
 */

export function parseNullableFloat(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseNullableInt(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Like parseFloat for submit-time validation, but decimal-comma tolerant. */
export function parseFlexibleFloat(value: string): number {
  return parseFloat(value.replace(",", "."));
}
