/**
 * Le libellé qu'une cellule porte quand la table se replie en cartes.
 *
 * Under 640px a table cannot keep its columns: five of them on a phone
 * either overflow sideways or squeeze every word to one letter per line.
 * The hand-written `.a-table` already reflows into stacked cards, using a
 * `data-label` on each cell — its header, repeated, because the header row
 * is gone.
 *
 * A PrimeVue `<Column>` writes no such attribute, so its tables were the
 * ones left scrolling sideways. `pt` is the way to add one:
 *
 *     <Column header="Compte" :pt="cell('Compte')">
 *
 * The label is passed rather than read from `header`, because several
 * columns carry a `#header` template instead of a plain string — and a
 * column of icons wants no label at all.
 */
export function cell(label: string): { bodyCell: { 'data-label': string } } {
  return { bodyCell: { 'data-label': label } }
}
