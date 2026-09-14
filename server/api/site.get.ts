import { eq } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { setting } from '~~/server/database/schema'

/**
 * Tous les réglages de portée PUBLIQUE.
 *
 * Le filtre sur `scope` est la frontière entre ce que Max règle et ce que
 * seul JB voit. Il est appliqué en SQL, et non en filtrant la réponse après
 * coup : un oubli de filtrage côté JavaScript serait invisible à la
 * relecture, alors qu'ici la requête ne ramène jamais les réglages
 * techniques.
 */
export default defineEventHandler(async () => {
  const db = useBase()

  const lignes = await db
    .select({ key: setting.key, value: setting.value })
    .from(setting)
    .where(eq(setting.scope, 'public'))

  return Object.fromEntries(lignes.map((l) => [l.key, l.value]))
})
