/** "Today", "Tomorrow", then "Thu 23". */
export function dayLabel(d: Date, i: number): string {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  return window.App.fmt.dayShort(d) + ' ' + d.getDate();
}
