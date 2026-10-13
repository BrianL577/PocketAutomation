/** All user-facing dates are in Eastern Time. The server (Vercel) runs in
 * UTC, so without an explicit zone a meeting recorded in the evening ET gets
 * stamped with the next day's date.
 */
export const DIGEST_TIME_ZONE = "America/New_York";

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: DIGEST_TIME_ZONE,
  });
}

export function dateTagParts(iso: string): { yy: string; mm: string; dd: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DIGEST_TIME_ZONE, year: "2-digit", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { yy: get("year"), mm: get("month"), dd: get("day") };
}
