/**
 * Sonde de vivacité. Aucune entrée-sortie : elle répond « le processus
 * tourne », rien de plus.
 *
 * C'est elle qu'interroge le HEALTHCHECK de l'image et, par voie de
 * conséquence, Traefik — qui refuse de router vers un conteneur unhealthy.
 * La faire dépendre de la base rendrait le site injoignable à la moindre
 * hoquet de PostgreSQL, alors que la plupart des pages n'en ont pas besoin.
 * L'état de la base se lit sur /api/health/ready.
 */
export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  return {
    status: 'ok' as const,
    environment: config.public.appEnv,
    version: config.public.version,
  }
})
