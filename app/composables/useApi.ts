/**
 * Les en-têtes à transmettre pour un appel `$fetch` pendant le RENDU SERVEUR.
 *
 * `useFetch` transmet le cookie de session tout seul ; `$fetch` non. Un
 * appel direct depuis un `setup` s'exécute donc côté serveur SANS session,
 * et l'API répond 401 — alors que l'utilisateur est bel et bien connecté.
 * Le symptôme est déroutant : la page échoue au premier chargement puis
 * fonctionne après navigation, parce que le second appel part du navigateur
 * qui, lui, porte son cookie.
 *
 * Côté navigateur, la fonction ne renvoie rien : le cookie part seul.
 */
export function enTetesDeSession(): Record<string, string> {
  return import.meta.server ? useRequestHeaders(['cookie']) : {}
}
