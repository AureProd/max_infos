/**
 * Reading a stylesheet as TEXT, because nothing else reads it.
 *
 * Biome does not parse CSS, `vue-tsc` neither, and a defect in these sheets
 * is invisible until someone looks at the screen. The two sheets of the
 * project are therefore asserted upon directly, the way `admin-styles` and
 * `admin-responsive` do.
 */

export type Rule = { selector: string; body: string }

/** Every rule of a sheet, as { selector, body }, at-rules flattened out. */
export function rules(css: string): Rule[] {
  const out: Rule[] = []
  // Comments first: a selector quoted in one is not a rule.
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of cleaned.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: (match[1] ?? '').trim(), body: match[2] ?? '' })
  }
  return out
}

/**
 * The body of one `@media` block, braces balanced.
 *
 * `rules()` above cannot serve here: it flattens everything, so a rule
 * written for the phone is indistinguishable from one written for the desk —
 * which is the whole question a responsive test asks.
 */
export function mediaBlock(css: string, query: string): string | null {
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const start = cleaned.indexOf(`@media ${query}`)
  if (start === -1) return null

  const open = cleaned.indexOf('{', start)
  if (open === -1) return null

  let depth = 0
  for (let i = open; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++
    else if (cleaned[i] === '}') {
      depth--
      if (depth === 0) return cleaned.slice(open + 1, i)
    }
  }
  return null
}

/** The declarations a selector carries inside a block, joined. */
export function declarationsOf(block: string, selector: string): string {
  return rules(block)
    .filter((r) =>
      r.selector
        .split(',')
        .some((s) => s.trim() === selector || s.trim().startsWith(`${selector} `)),
    )
    .map((r) => r.body)
    .join(';')
}
