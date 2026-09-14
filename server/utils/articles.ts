import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { slugify } from '#shared/utils/slug'
import { useBase } from '~~/server/database/client'
import { article, articleTag, tag } from '~~/server/database/schema'
import { compterCaracteres, minutesDeLecture, rendreMarkdown } from './markdown'

/**
 * Rattache un article à une liste de sujets, en créant ceux qui manquent.
 *
 * Remplace l'ensemble plutôt que d'ajouter : c'est ce qu'attend un
 * formulaire où l'on retire un sujet. Les sujets devenus orphelins ne sont
 * pas supprimés — ils resservent, et les effacer ferait disparaître une
 * couleur choisie à la main.
 */
export async function remplacerSujets(articleId: number, libelles: string[]): Promise<void> {
  const db = useBase()
  const voulus = [...new Set(libelles.map((l) => l.trim()).filter(Boolean))]

  if (voulus.length === 0) {
    await db.delete(articleTag).where(eq(articleTag.articleId, articleId))
    return
  }

  const ids: number[] = []
  for (const libelle of voulus) {
    const [ligne] = await db
      .insert(tag)
      .values({ slug: slugify(libelle), label: libelle })
      .onConflictDoUpdate({ target: tag.slug, set: { label: libelle } })
      .returning({ id: tag.id })
    if (ligne) ids.push(ligne.id)
  }

  await db
    .delete(articleTag)
    .where(and(eq(articleTag.articleId, articleId), notInArray(articleTag.tagId, ids)))

  for (const tagId of ids) {
    await db.insert(articleTag).values({ articleId, tagId }).onConflictDoNothing()
  }
}

/**
 * Les champs dérivés du corps, recalculés à chaque enregistrement.
 *
 * Le HTML est rendu ICI et nulle part ailleurs : c'est ce qui garantit que
 * rien de non assaini n'entre en base.
 */
export function champsDerives(bodyMd: string) {
  return {
    bodyHtml: rendreMarkdown(bodyMd),
    charCount: compterCaracteres(bodyMd),
    readingMinutes: minutesDeLecture(bodyMd),
  }
}

/**
 * Trouve un slug libre à partir d'un titre : `mon-titre`, puis `mon-titre-2`…
 *
 * Sans cela, publier deux articles au titre proche renverrait une violation
 * de contrainte à la figure de Max, qui n'y peut rien.
 */
export async function slugLibre(titre: string, sauf?: number): Promise<string> {
  const db = useBase()
  const base = slugify(titre) || 'article'
  for (let n = 1; n < 200; n++) {
    const candidat = n === 1 ? base : `${base}-${n}`
    const [pris] = await db
      .select({ id: article.id })
      .from(article)
      .where(eq(article.slug, candidat))
      .limit(1)
    if (!pris || pris.id === sauf) return candidat
  }
  return `${base}-${Date.now()}`
}

/** Supprime les sujets qui ne portent plus aucun article. */
export async function nettoyerSujetsOrphelins(): Promise<number> {
  const db = useBase()
  const utilises = db.selectDistinct({ id: articleTag.tagId }).from(articleTag)
  const supprimes = await db
    .delete(tag)
    .where(notInArray(tag.id, utilises))
    .returning({ id: tag.id })
  return supprimes.length
}

/** Les identifiants de sujets d'un article, pour l'API d'administration. */
export async function sujetsDe(articleId: number) {
  return await useBase()
    .select({ slug: tag.slug, label: tag.label })
    .from(articleTag)
    .innerJoin(tag, eq(tag.id, articleTag.tagId))
    .where(eq(articleTag.articleId, articleId))
}

export { inArray }
