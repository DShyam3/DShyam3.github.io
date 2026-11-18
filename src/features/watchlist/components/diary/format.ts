/** Minutes as "12h 5m" / "45m" / "0m". Unlike formatRuntime, zero is shown. */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  return hours > 0 ? `${hours}h ${total % 60}m` : `${total}m`;
}

/** "Wed 12 Nov 2026" from a YYYY-MM-DD. */
export function formatDayHeading(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(y, m - 1, d, 12));
}

/** A total, prefixed "at least" when some runtimes are unknown. */
export function formatTotal(minutes: number, unknownRuntime: number): string {
  return `${unknownRuntime > 0 ? 'at least ' : ''}${formatMinutes(minutes)}`;
}
