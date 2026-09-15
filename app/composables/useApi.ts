/**
 * The headers to forward for a `$fetch` call DURING SERVER RENDERING.
 *
 * `useFetch` forwards the session cookie on its own; `$fetch` does not. A
 * direct call from a `setup` therefore runs server-side WITHOUT a session,
 * and the API answers 401 — while the user is very much signed in. The
 * symptom is confusing: the page fails on first load then works after
 * navigating, because the second call leaves from the browser, which does
 * carry its cookie.
 *
 * In the browser the function returns nothing: the cookie goes on its own.
 */
export function sessionHeaders(): Record<string, string> {
  return import.meta.server ? useRequestHeaders(['cookie']) : {}
}
