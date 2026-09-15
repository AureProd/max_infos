import { z } from 'zod'

/**
 * Fabrique une session pour un identifiant donné. RÉSERVÉ AUX TESTS.
 *
 * Cette route est une porte dérobée par nature : elle ouvre une session
 * sans aucune preuve d'identité. Elle existe parce que le test
 * d'autorisations doit pouvoir se présenter comme `editor` then comme
 * `tech` sans passer par Google — et ce test est le garde-fou le plus
 * important du projet.
 *
 * Deux verrous INDÉPENDANTS la maintiennent hors de la production :
 *
 *  1. Le bundle. `nitro.ignore` retire all server/api/test/ de la
 *     compilation, sauf si NUXT_TEST_ROUTES vaut « true » AU MOMENT DU
 *     BUILD. Par défaut la route n'existe donc même pas dans l'image.
 *  2. L'exécution. Même compilée, elle refuse de répondre si
 *     l'environnement n'est pas « dev ».
 *
 * Un seul verrou suffirait ; two protègent d'une error sur l'un des two.
 */
export default defineEventHandler(async (event) => {
  const { public: pub } = useRuntimeConfig()
  if (pub.appEnv !== 'dev') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const { id } = await readValidatedBody(event, z.object({ id: z.number().int() }).parse)
  await setUserSession(event, { user: { id } })
  return { ok: true as const }
})
