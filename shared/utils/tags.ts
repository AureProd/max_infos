/**
 * The subjects of an article.
 *
 * They used to be typed into a free-text field split on commas: a comma
 * inside a label cut it in two, and « Histoire » typed in a hurry became a
 * second tag next to « Histoire ». What follows is the whole rule — pick
 * from what exists, and create only what matches nothing.
 */

/** Trimmed, and with its inner spacing collapsed. Commas are kept. */
export function normalizeTagLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** Case and accents removed: the two ways the same tag used to double. */
function fold(label: string): string {
  return normalizeTagLabel(label).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Adds a label, preferring the spelling already in use.
 *
 * Returns the list unchanged when there is nothing to add, so a caller can
 * assign the result without thinking about it.
 */
export function addTagLabel(
  selected: readonly string[],
  known: readonly string[],
  raw: string,
): string[] {
  const wanted = normalizeTagLabel(raw)
  if (wanted === '') return [...selected]

  const existing = known.find((k) => fold(k) === fold(wanted))
  const label = existing ?? wanted
  if (selected.some((s) => fold(s) === fold(label))) return [...selected]
  return [...selected, label]
}

/** Selects what was not selected, deselects what was. */
export function toggleTag(selected: readonly string[], label: string): string[] {
  return selected.some((s) => fold(s) === fold(label))
    ? selected.filter((s) => fold(s) !== fold(label))
    : [...selected, label]
}
