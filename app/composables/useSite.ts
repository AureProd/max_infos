import type { SitePublic } from '#shared/types/site'

/**
 * Les réglages publics du site, chargés UNE SEULE FOIS et partagés.
 *
 * La clé passée à `useFetch` est ce qui permet ce partage : masthead, pied
 * de page, accueil et page « à propos » appellent all ce composable, mais
 * la requête n'est faite qu'une fois, et son résultat est sérialisé du
 * serveur vers le client avec le rendered — donc aucun call côté navigateur
 * au first chargement.
 */
export function useSite() {
  return useFetch<SitePublic>('/api/site', { key: 'site' })
}
