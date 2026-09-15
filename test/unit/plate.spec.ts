import { describe, expect, it } from 'vitest'
import { plate } from '../../app/utils/plate'

describe('plate', () => {
  it('depends only on the seed, which is what makes it hydration-safe', () => {
    // The server renders the plate, then the browser renders it again. If the
    // two differed by one decimal, Vue would discard the whole subtree.
    expect(plate(7)).toEqual(plate(7))
    // Compared without the gradient identifier, which carries the seed on its
    // own: what must differ is the DRAWING.
    const drawing = (seed: number) => plate(seed).inner.replaceAll(`g${seed}-`, 'gid-')
    expect(drawing(7)).not.toBe(drawing(8))
  })

  it('reports the dimensions it was asked for', () => {
    expect(plate(1)).toMatchObject({ viewBox: '0 0 400 400', ratio: '400 / 400' })
    expect(plate(1, 800, 300)).toMatchObject({ viewBox: '0 0 800 300', ratio: '800 / 300' })
  })

  it('gives two sizes of the same seed two gradient identifiers', () => {
    // Both plates can sit on the same page; a shared id would have the small
    // one borrow the large one's glow.
    const square = plate(3, 400, 400).inner.match(/id="(g3-[^"]+)"/)?.[1]
    const wide = plate(3, 800, 300).inner.match(/id="(g3-[^"]+)"/)?.[1]
    expect(square).toBe('g3-400x400')
    expect(wide).toBe('g3-800x300')
  })

  it('draws the whole vocabulary whatever the seed', () => {
    // Every branch of the trace loop turns on a coin flip: one seed only ever
    // takes one side, so the invariants are asserted over a spread of them.
    for (const seed of [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144]) {
      const { inner } = plate(seed)
      expect(inner).toContain('<rect width="400" height="400" fill="#11161C"/>')
      expect(inner).toContain('<polyline points="')
      expect(inner).toContain('<circle cx="')
      expect(inner).toContain('<radialGradient')
      expect(inner).toContain(`url(#g${seed}-400x400)`)
    }
  })

  it('keeps every trace inside the frame', () => {
    // The strokes wander by fixed steps and would otherwise run off the plate.
    for (const seed of [0, 4, 9, 16, 25, 36, 49]) {
      const points = [...plate(seed, 400, 400).inner.matchAll(/points="([^"]+)"/g)]
      expect(points.length).toBeGreaterThan(0)
      for (const [, list] of points) {
        for (const pair of (list as string).split(' ').slice(1)) {
          const [x, y] = pair.split(',').map(Number)
          expect(x).toBeGreaterThanOrEqual(8)
          expect(x).toBeLessThanOrEqual(392)
          expect(y).toBeGreaterThanOrEqual(8)
          expect(y).toBeLessThanOrEqual(392)
        }
      }
    }
  })

  it('lays the grid out at the pitch the dimensions dictate', () => {
    const { inner } = plate(2, 100, 60)
    // step = 22, strictly inside: 22, 44, 66, 88 vertically; 22, 44 horizontally.
    expect([...inner.matchAll(/<line x1="\d+" y1="0"/g)]).toHaveLength(4)
    expect([...inner.matchAll(/<line x1="0" y1="\d+"/g)]).toHaveLength(2)
  })
})
