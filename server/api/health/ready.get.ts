import { verifierBase } from '~~/server/database/client'

/**
 * Sonde de disponibilité : « la base répond-elle ? ».
 *
 * Séparée de /api/health à dessein. La vivacité conditionne le routage
 * Traefik — un conteneur unhealthy ne reçoit plus de trafic — et l'y lier
 * rendrait le site injoignable au moindre hoquet de PostgreSQL. Celle-ci
 * sert aux vérifications de déploiement et à la supervision.
 *
 * Renvoie 503 quand la base est injoignable : c'est le code que lisent les
 * orchestrateurs, et il ne doit pas être confondu avec une erreur 500 de
 * l'application.
 */
export default defineEventHandler(async (event) => {
  try {
    const { latenceMs } = await verifierBase()
    return { status: 'ok' as const, database: 'ok' as const, latenceMs }
  } catch (erreur) {
    setResponseStatus(event, 503)
    return {
      status: 'degraded' as const,
      database: 'injoignable' as const,
      raison: erreur instanceof Error ? erreur.message : String(erreur),
    }
  }
})
