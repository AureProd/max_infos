import { describe, expect, it } from 'vitest'
import { dayRange, fillDays } from '~~/server/utils/stats'

/**
 * A reading curve must not lie about the days nobody read.
 *
 * `article_view` only holds rows for days that had a reading. Plotted as
 * they come, a week with two readings four days apart draws a straight line
 * between them — the graph invents four days of steady traffic that never
 * happened, and the quiet days, which are the interesting ones, disappear.
 */
describe('fillDays', () => {
  const days = dayRange('2026-09-01', '2026-09-05')

  it('gives one point per day of the range, in order', () => {
    expect(days).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'])
  })

  it('puts a zero on a day that has no row, rather than skipping it', () => {
    const filled = fillDays([{ day: '2026-09-03', views: 12 }], days)
    expect(filled).toEqual([
      { day: '2026-09-01', views: 0 },
      { day: '2026-09-02', views: 0 },
      { day: '2026-09-03', views: 12 },
      { day: '2026-09-04', views: 0 },
      { day: '2026-09-05', views: 0 },
    ])
  })

  it('adds up several rows landing on the same day', () => {
    // Une ligne par article : la courbe du site est leur somme.
    const filled = fillDays(
      [
        { day: '2026-09-02', views: 3 },
        { day: '2026-09-02', views: 4 },
      ],
      days,
    )
    expect(filled[1]).toEqual({ day: '2026-09-02', views: 7 })
  })

  it('ignores a row outside the range instead of stretching it', () => {
    const filled = fillDays([{ day: '2026-08-30', views: 99 }], days)
    expect(filled.every((d) => d.views === 0)).toBe(true)
  })

  it('crosses a month boundary', () => {
    // Une fenêtre de trente jours en franchit une fois sur deux, et un
    // calcul en jours du mois s'y casse.
    expect(dayRange('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ])
  })
})
