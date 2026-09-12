const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre'
]

const parse = (iso) => new Date(`${iso}T12:00:00`)

export const frDate = (iso) => {
  const d = parse(iso)
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`
}

export const frShort = (iso) => {
  const d = parse(iso)
  return `${d.getDate()} ${MOIS[d.getMonth()].slice(0, 4)}.`
}

export const nb = (n) => n.toLocaleString('fr-FR')

export const countChars = (text) => text.replace(/\s+/g, ' ').length
