#!/usr/bin/env node
// Contrôles d'hygiène des fichiers, en remplacement des hooks Python de
// `pre-commit-hooks`. Huit contrôles, un par ancien hook : espaces en fin de
// ligne, nouvelle ligne finale, fins de ligne CRLF, marqueurs de conflit,
// fichiers volumineux, collisions de casse, YAML et JSON valides.
//
// Contrairement aux hooks d'origine, celui-ci NE CORRIGE RIEN : il signale.
// Un hook qui réécrit les fichiers sous le commit rend le diff relu différent
// du diff commité, et Biome corrige déjà tout ce qui relève du format.
//
// Le fichier expose des fonctions pures pour être testable (test/unit/hygiene.spec.ts) ;
// la partie exécutable ne lit l'index Git que si on l'appelle en ligne de commande.
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

// Ancrés en début de ligne et suivis d'une espace : c'est la forme exacte que
// Git écrit, et elle ne peut pas apparaître par accident dans du code.
const MARQUEUR_DE_CONFLIT = /^(<{7}|={7}|>{7})(\s|$)/m

/** Un octet nul ne se rencontre pas dans du texte : le fichier est binaire. */
function estBinaire(contenu) {
  return contenu.includes(0)
}

/**
 * Les problèmes d'un fichier, sous la forme `{ regle, message }`.
 * @param {{ chemin: string, contenu: Buffer }} fichier
 */
export function controlerFichier({ chemin, contenu }) {
  const problemes = []
  const signaler = (regle, message) => problemes.push({ chemin, regle, message })

  if (contenu.byteLength > TAILLE_MAX_KO * 1024) {
    const ko = Math.round(contenu.byteLength / 1024)
    signaler('fichier-volumineux', `${ko} ko, au-delà des ${TAILLE_MAX_KO} ko admis`)
  }

  // Un binaire n'a ni ligne, ni encodage à vérifier.
  if (estBinaire(contenu)) return problemes

  const texte = contenu.toString('utf8')
  if (texte.length === 0) return problemes

  if (texte.includes('\r\n')) {
    signaler('fin-de-ligne-mixte', 'fins de ligne CRLF, attendu LF')
  }

  if (!texte.endsWith('\n')) {
    signaler('newline-finale', 'pas de nouvelle ligne en fin de fichier')
  }

  if (!SANS_CONTROLE_D_ESPACES.test(chemin)) {
    const lignes = texte.split('\n')
    const fautives = lignes
      .map((ligne, i) => (/[ \t]+\r?$/.test(ligne) ? i + 1 : 0))
      .filter(Boolean)
    if (fautives.length > 0) {
      signaler('espaces-en-fin-de-ligne', `ligne(s) ${fautives.join(', ')}`)
    }
  }

  if (MARQUEUR_DE_CONFLIT.test(texte)) {
    signaler('marqueur-de-conflit', 'conflit de fusion non résolu')
  }

  if (EST_YAML.test(chemin)) {
    // `--allow-multiple-documents` de l'ancien hook : un compose rendu peut
    // en contenir plusieurs.
    const erreurs = parseAllDocuments(texte).flatMap((doc) => doc.errors)
    if (erreurs.length > 0) signaler('yaml-invalide', erreurs[0].message.split('\n')[0])
  }

  if (EST_JSON.test(chemin) && !HORS_JSON_STRICT.test(chemin)) {
    try {
      JSON.parse(texte)
    } catch (erreur) {
      signaler('json-invalide', erreur.message)
    }
  }

  return problemes
}

/**
 * Deux chemins qui ne diffèrent que par la casse : invisible sous Linux,
 * destructeur au clone sous macOS ou Windows.
 * @param {string[]} chemins
 */
export function controlerCollisionsDeCasse(chemins) {
  const vus = new Map()
  const problemes = []
  for (const chemin of chemins) {
    const cle = chemin.toLowerCase()
    const deja = vus.get(cle)
    if (deja !== undefined) {
      problemes.push({
        chemin,
        regle: 'collision-de-casse',
        message: `ne diffère de ${deja} que par la casse`,
      })
    } else {
      vus.set(cle, chemin)
    }
  }
  return problemes
}

/** Les fichiers indexés, ou ceux passés en arguments. */
function fichiersAControler(arguments_) {
  if (arguments_.length > 0) return arguments_
  const sortie = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    encoding: 'utf8',
  })
  return sortie.split('\n').filter(Boolean)
}

function principal() {
  const chemins = fichiersAControler(process.argv.slice(2))
  const problemes = controlerCollisionsDeCasse(chemins)

  for (const chemin of chemins) {
    // Un fichier indexé puis supprimé du disque ne se lit pas : ce n'est pas
    // une faute d'hygiène.
    let contenu
    try {
      if (!statSync(chemin).isFile()) continue
      contenu = readFileSync(chemin)
    } catch {
      continue
    }
    problemes.push(...controlerFichier({ chemin, contenu }))
  }

  if (problemes.length === 0) return 0

  console.error('/!\\ Hygiène des fichiers :')
  for (const { chemin, regle, message } of problemes) {
    console.error(`    ${chemin} — ${regle} : ${message}`)
  }
  return 1
}

if (import.meta.filename === process.argv[1]) process.exit(principal())
