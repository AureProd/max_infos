/**
 * The look of every graph in the back-office, in one place.
 *
 * All three are SINGLE-SERIES — readings per day, per article, per tag — so
 * they wear one hue, the accent, and carry no legend: the title already
 * names what is plotted. Giving each bar its own colour would encode
 * identity that the axis labels already carry, and invent a rainbow.
 *
 * The colours are read from the computed style rather than written here, so
 * the graphs follow the `@theme` tokens like everything else.
 */
export function useChartTheme() {
  const token = (name: string, fallback: string): string => {
    if (typeof window === 'undefined') return fallback
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  }

  interface ChartColors {
    accent: string
    accentSoft: string
    ink: string
    muted: string
    line: string
    surface: string
  }

  const colors = computed<ChartColors>(() => ({
    accent: token('--color-accent', '#2563eb'),
    accentSoft: token('--color-accent-soft', '#e8effd'),
    ink: token('--color-ink', '#363737'),
    muted: token('--color-muted', '#777878'),
    line: token('--color-line-soft', '#e6e6e6'),
    surface: token('--color-surface', '#ffffff'),
  }))

  /** Axes and grid, deliberately recessive: the data is the figure. */
  const scale = (c: ChartColors) => ({
    grid: { color: c.line, drawTicks: false },
    border: { display: false },
    ticks: { color: c.muted, font: { family: 'Lexend', size: 11 }, padding: 8 },
  })

  const base = computed(() => {
    const c = colors.value
    return {
      responsive: true,
      maintainAspectRatio: false,
      // Une seule série : la légende ne dirait que ce que le titre dit déjà.
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.ink,
          titleFont: { family: 'Lexend', size: 12 },
          bodyFont: { family: 'Lexend', size: 12 },
          padding: 10,
          displayColors: false,
          cornerRadius: 6,
        },
      },
      scales: { x: scale(c), y: scale(c) },
      interaction: { mode: 'index' as const, intersect: false },
    }
  })

  return { colors, base }
}
