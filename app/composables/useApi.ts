/**
 * Les en-têtes à transmettre pour un call `$fetch` pendant le RENDU SERVEUR.
 *
 * `useFetch` transmet le cookie de session all seul ; `$fetch` non. Un
 * call direct since un `setup` s'exécute donc côté serveur SANS session,
 * et l'API répond 401 — alors que l'user est bel et bien connecté.
 * Le symptôme est déroutant : la page échoue au first chargement then
 * fonctionne après navigation, parce que le second call part du navigateur
 * qui, lui, porte son cookie.
 *
 * Côté navigateur, la fonction ne renvoie rien : le cookie part seul.
 */
export function sessionHeaders(): Record<string, string> {
  return import.meta.server ? useRequestHeaders(['cookie']) : {}
}
