/** "2026-10-26T09:30:00Z" -> "26 October 2026". Em UTC, para o servidor e o browser mostrarem sempre o mesmo dia. */
export function formatReportDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "UTC" });
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatHours(hours: number | null): string {
  return hours === null ? "N/A" : `${hours}h`;
}
