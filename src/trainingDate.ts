export function localDateString(date = new Date()): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function formatTrainingDate(date: string): string {
  const parsed = new Date(date + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return date;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = parsed.toLocaleString("en-US", { month: "short" });
  return `${day}/${month}/${parsed.getFullYear()}`;
}
