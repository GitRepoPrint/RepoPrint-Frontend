/** "2026-10-26T09:30:00Z" -> "26 October 2026". Em UTC, para o servidor e o browser mostrarem sempre o mesmo dia. */
export function formatReportDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "UTC" });
}
