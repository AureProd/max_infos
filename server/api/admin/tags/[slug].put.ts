import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { slugify } from '#shared/utils/slug'
import { useDatabase } from '~~/server/database/client'
import { tag } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Corrects the spelling of a subject.
 *
 * Nothing could rename one: a typo was carried by every article bearing it,
 * for good, and the only way out was to retype the subject on each of them.
 *
 * The slug follows the label. It is what the public filter carries in its
 * URL, so regenerating it does change an address — but leaving « scootisme »
 * visible forever to spare a link nobody has yet is the worse trade. The
 * articles are unaffected: the link is made by identifier, not by name.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')

  const { slug } = await getValidatedRouterParams(
    event,
    z.object({ slug: z.string().trim().min(1) }).parse,
  )
  const { label } = await readValidatedBody(
    event,
    z.object({ label: z.string().trim().min(1).max(80) }).parse,
  )

  const db = useDatabase()
  const [found] = await db.select({ id: tag.id }).from(tag).where(eq(tag.slug, slug))
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Sujet introuvable' })

  // « «  » » slugifies to nothing, and a tag without a slug is a tag no
  // filter can ever reach.
  const wanted = slugify(label)
  if (!wanted) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Ce nom ne produit aucune adresse utilisable',
    })
  }

  const [taken] = await db
    .select({ id: tag.id })
    .from(tag)
    .where(and(eq(tag.slug, wanted), ne(tag.id, found.id)))

  if (taken) {
    // Fusionner deux sujets est une autre opération. Écraser en silence en
    // perdrait un.
    throw createError({
      statusCode: 409,
      statusMessage: 'Un autre sujet porte déjà ce nom',
    })
  }

  const [renamed] = await db
    .update(tag)
    .set({ label, slug: wanted })
    .where(eq(tag.id, found.id))
    .returning()

  return renamed
})
