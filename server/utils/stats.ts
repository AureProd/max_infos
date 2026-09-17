/**
 * Turning reading counters into something a graph can draw.
 *
 * `article_view` holds one row per article and per day, and ONLY for days
 * that had a reading. Plotted as they come, a week with two readings four
 * days apart draws a straight line between them: the graph invents four
 * days of steady traffic, and the quiet days — the ones worth noticing —
 * vanish.
 *
 * These two functions are pure, and tested as such: the SQL above them is
 * a `group by`, which is not where this kind of mistake hides.
 */

/** Every day from `from` to `to`, inclusive, as bare ISO dates. */
export function dayRange(from: string, to: string): string[] {
  const days: string[] = []
  // UTC throughout: `day` is a bare DATE column, with no time and no zone.
  // Walking it in local time shifts a day every DST change, and the curve
  // silently loses or repeats one.
  const end = Date.parse(`${to}T00:00:00Z`)
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10))
  }
  return days
}

/** Today, shifted by `days`, as a bare ISO date. */
export function isoDay(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

export interface DayCount {
  day: string
  views: number
}

/**
 * One point per day of `days`, summing the rows that land on each.
 *
 * A row outside the range is dropped rather than clamped: stretching it to
 * the nearest edge would put yesterday's readings on a day that had none.
 */
export function fillDays(rows: readonly DayCount[], days: readonly string[]): DayCount[] {
  const totals = new Map(days.map((day) => [day, 0]))
  for (const row of rows) {
    const known = totals.get(row.day)
    if (known !== undefined) totals.set(row.day, known + row.views)
  }
  return days.map((day) => ({ day, views: totals.get(day) ?? 0 }))
}
