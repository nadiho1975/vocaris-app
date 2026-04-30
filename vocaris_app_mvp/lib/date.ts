export function koreaDateString(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(date);
}

export function daysAgoDateString(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return koreaDateString(d);
}
