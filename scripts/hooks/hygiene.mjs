#!/usr/bin/env node
// Contrôles d'hygiène des files, en remplacement des hooks Python de
// `pre-commit-hooks`. Huit contrôles, un par ancien hook : espaces en fin de
// row, nouvelle row finale, fins de row CRLF, marqueurs de conflit,
// files volumineux, collisions de casse, YAML et JSON valides.
//
// Contrairement aux hooks d'origine, celui-ci NE CORRIGE RIEN : il signale.
// Un hook qui réécrit les files sous le commit rend le diff relu différent
// du diff commité, et Biome corrige déjà all ce qui relève du format.
//
// Le file expose des fonctions pures pour être testable (test/unit/hygiene.spec.ts) ;
// la partie exécutable ne lit l'index Git que si on l'appelle en row de commande.
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { parseAllDocuments } from 'yaml'

/** Au-delà, c'est un artefact : il n'a rien à faire dans l'historique Git. */
export const TAILLE_MAX_KO = 512

/** La typographie française des articles ne doit pas être retouchée. */
const SANS_CONTROLE_D_ESPACES = /\.md$/

/** Biome se configure en JSONC : commentaires et virgules finales y sont légitimes. */
const HORS_JSON_STRICT = /^\.vscode\/|\.jsonc$/

const EST_YAML = /\.ya?ml$/
const EST_JSON = /\.json$/

// Ancrés en début de row et suivis d'une espace : c'est la shape exacte que
// Git écrit, et elle ne peut pas apparaître par accident dans du code.
const MARQUEUR_DE_CONFLIT = /^(<{7}|={7}|>{7})(\s|$)/m

/** Un octet nul ne se rencontre pas dans du text : le file est binary. */
function estBinaire(content) {
  return content.includes(0)
}

/**
 * Les problèmes d'un file, sous la shape `{ regle, message }`.
 * @param {{ path: string, content: Buffer }} file
 */
export function controlerFichier({ path, content }) {
  const problems = []
  const signaler = (regle, message) => problems.push({ path, regle, message })

  if (content.byteLength > TAILLE_MAX_KO * 1024) {
    const ko = Math.round(content.byteLength / 1024)
    signaler('fichier-volumineux', `${ko} ko, au-delà des ${TAILLE_MAX_KO} ko admis`)
  }

  // Un binary n'a ni row, ni encodage à vérifier.
  if (estBinaire(content)) return problems

  const text = content.toString('utf8')
  if (text.length === 0) return problems

  if (text.includes('\r\n')) {
    signaler('fin-de-ligne-mixte', 'fins de ligne CRLF, attendu LF')
  }

  if (!text.endsWith('\n')) {
    signaler('newline-finale', 'pas de nouvelle ligne en fin de fichier')
  }

  if (!SANS_CONTROLE_D_ESPACES.test(path)) {
    const lines = text.split('\n')
    const fautives = lines.map((row, i) => (/[ \t]+\r?$/.test(row) ? i + 1 : 0)).filter(Boolean)
    if (fautives.length > 0) {
      signaler('espaces-en-fin-de-ligne', `ligne(s) ${fautives.join(', ')}`)
    }
  }

  if (MARQUEUR_DE_CONFLIT.test(text)) {
    signaler('marqueur-de-conflit', 'conflit de fusion non résolu')
  }

  if (EST_YAML.test(path)) {
    // `--allow-multiple-documents` de l'ancien hook : un compose rendered peut
    // en contenir plusieurs.
    const erreurs = parseAllDocuments(text).flatMap((doc) => doc.errors)
    if (erreurs.length > 0) signaler('yaml-invalide', erreurs[0].message.split('\n')[0])
  }

  if (EST_JSON.test(path) && !HORS_JSON_STRICT.test(path)) {
    try {
      JSON.parse(text)
    } catch (error) {
      signaler('json-invalide', error.message)
    }
  }

  return problems
}

/**
 * Deux chemins qui ne diffèrent que par la casse : invisible sous Linux,
 * destructeur au clone sous macOS ou Windows.
 * @param {string[]} chemins
 */
export function controlerCollisionsDeCasse(chemins) {
  const vus = new Map()
  const problems = []
  for (const path of chemins) {
    const key = path.toLowerCase()
    const deja = vus.get(key)
    if (deja !== undefined) {
      problems.push({
        path,
        regle: 'collision-de-casse',
        message: `ne diffère de ${deja} que par la casse`,
      })
    } else {
      vus.set(key, path)
    }
  }
  return problems
}

/** Les files indexés, ou ceux passés en arguments. */
function fichiersAControler(arguments_) {
  if (arguments_.length > 0) return arguments_
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    encoding: 'utf8',
  })
  return output.split('\n').filter(Boolean)
}

function main() {
  const chemins = fichiersAControler(process.argv.slice(2))
  const problems = controlerCollisionsDeCasse(chemins)

  for (const path of chemins) {
    // Un file indexé then supprimé du disque ne se lit pas : ce n'est pas
    // une faute d'hygiène.
    let content
    try {
      if (!statSync(path).isFile()) continue
      content = readFileSync(path)
    } catch {
      continue
    }
    problems.push(...controlerFichier({ path, content }))
  }

  if (problems.length === 0) return 0

  console.error('/!\\ Hygiène des fichiers :')
  for (const { path, regle, message } of problems) {
    console.error(`    ${path} — ${regle} : ${message}`)
  }
  return 1
}

if (import.meta.filename === process.argv[1]) process.exit(main())
