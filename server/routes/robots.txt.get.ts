/**
 * robots.txt.
 *
 * The back-office and the sign-in page are excluded explicitly: they
 * already carry `noindex`, but a robot that does not read the page will
 * never see it.
 */
export default defineEventHandler((event) => {
  const { public: pub } = useRuntimeConfig()
  const base = pub.baseUrl.replace(/\/+$/, '')

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')

  // On an unpublished site we disallow everything: an indexed staging
  // environment duplicates production and hurts it.
  if (pub.appEnv !== 'prod') {
    return `User-agent: *\nDisallow: /\n`
  }

  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /login
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`
})
