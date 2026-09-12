/**
 * Visuels d'atelier générés, déterministes pour une graine donnée.
 * Aucune requête réseau : la maquette fonctionne hors ligne.
 * En production ces plaques seront remplacées par les vraies images.
 */
function rng(seed) {
  let s = seed * 1973 + 7
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function plate(seed, w = 400, h = 400) {
  const r = rng(seed)
  const p = []
  p.push(`<rect width="${w}" height="${h}" fill="#11161C"/>`)

  const step = 22
  for (let x = step; x < w; x += step)
    p.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="rgba(255,255,255,.028)" stroke-width="1"/>`
    )
  for (let y = step; y < h; y += step)
    p.push(
      `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="rgba(255,255,255,.028)" stroke-width="1"/>`
    )

  const blocks = 2 + Math.floor(r() * 3)
  for (let i = 0; i < blocks; i++) {
    const bw = w * (0.18 + r() * 0.34)
    const bh = h * (0.12 + r() * 0.3)
    const x = r() * (w - bw)
    const y = r() * (h - bh)
    p.push(
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="#1B222A" stroke="rgba(255,255,255,.07)" stroke-width="1"/>`
    )
  }

  const traces = 2 + Math.floor(r() * 3)
  for (let i = 0; i < traces; i++) {
    let x = r() * w
    let y = r() * h
    const pts = [[x, y]]
    for (let k = 0; k < 3 + Math.floor(r() * 3); k++) {
      const len = 26 + r() * 96
      if (r() > 0.5) x += r() > 0.5 ? len : -len
      else y += r() > 0.5 ? len : -len
      pts.push([Math.max(8, Math.min(w - 8, x)), Math.max(8, Math.min(h - 8, y))])
    }
    const pointList = pts.map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' ')
    p.push(
      `<polyline points="${pointList}" fill="none" stroke="rgba(217,163,83,${(0.24 + r() * 0.34).toFixed(2)})" stroke-width="${(1 + r() * 1.6).toFixed(1)}" stroke-linejoin="round" stroke-linecap="round"/>`
    )
    const last = pts[pts.length - 1]
    p.push(
      `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="${(2.4 + r() * 2.6).toFixed(1)}" fill="#D9A353" opacity=".8"/>`
    )
  }

  // lueur de lampe d'établi ; l'identifiant inclut les dimensions pour éviter
  // les collisions entre deux plaques de même graine à des tailles différentes
  const gid = `g${seed}-${w}x${h}`
  p.push(
    `<defs><radialGradient id="${gid}" cx="${(r() * 100).toFixed(0)}%" cy="${(r() * 60).toFixed(0)}%" r="72%">` +
      `<stop offset="0%" stop-color="#D9A353" stop-opacity=".17"/>` +
      `<stop offset="100%" stop-color="#D9A353" stop-opacity="0"/></radialGradient></defs>`
  )
  p.push(`<rect width="${w}" height="${h}" fill="url(#${gid})"/>`)

  return {
    viewBox: `0 0 ${w} ${h}`,
    ratio: `${w} / ${h}`,
    inner: p.join('')
  }
}
