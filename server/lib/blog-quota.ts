export const BLOG_RECOMMENDED_PER_MONTH = 7;
export const BLOG_HARD_LIMIT_PER_MONTH = 15;

/** First instant of the current month in Europe/Athens, as a UTC Date. */
export function athensMonthStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const year = Number(read("year"));
  const month = Number(read("month"));
  const utcMidnight = Date.UTC(year, month - 1, 1, 0, 0, 0);
  const offsetLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Athens",
    timeZoneName: "longOffset",
    hour: "2-digit",
  })
    .formatToParts(new Date(utcMidnight))
    .find((part) => part.type === "timeZoneName")?.value || "GMT+02:00";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offsetLabel);
  const sign = match?.[1] === "-" ? -1 : 1;
  const hours = Number(match?.[2] || "2");
  const minutes = Number(match?.[3] || "0");
  return new Date(utcMidnight - sign * (hours * 60 + minutes) * 60 * 1000);
}
