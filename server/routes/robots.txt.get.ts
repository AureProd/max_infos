/**
 * robots.txt.
 *
 * Le back-office et la connexion sont explicitement écartés : ils portent
 * déjà `noindex`, mais un robot qui ne lit pas la page ne le verra jamais.
 */
export default defineEventHandler((event) => {
  const { public: pub } = useRuntimeConfig()
  const base = pub.baseUrl.replace(/\/+$/, '')

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')

  // Sur un site non publié, on interdit tout : une préproduction indexée
  // fait doublon avec la production et lui nuit.
  if (pub.appEnv !== 'prod') {
    return `User-agent: *\nDisallow: /\n`
  }

  return `User-agent: *
Allow: /
Disallow: /redaction
Disallow: /connexion
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`
})
