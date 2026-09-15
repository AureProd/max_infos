import { desc, eq } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'

const x = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/**
 * Plan du site : les pages publiques et les articles publiés.
 *
 * /admin et /login n'y figurent PAS — elles portent déjà
 * `noindex`, et les lister reviendrait à indiquer où frapper.
 */
export default defineEventHandler(async (event) => {
  const { public: pub } = useRuntimeConfig()
  const base = pub.baseUrl.replace(/\/+$/, '')

  const articles = await useBase()
    .select({ slug: article.slug, updatedAt: article.updatedAt })
    .from(article)
    .where(eq(article.status, 'published'))
    .orderBy(desc(article.publishedAt))

  const jour = (d: Date): string => d.toISOString().slice(0, 10)

  const urls = [
    `  <url><loc>${x(base)}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${x(base)}/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
    ...articles.map(
      (a) =>
        `  <url><loc>${x(base)}/article/${a.slug}</loc><lastmod>${jour(a.updatedAt)}</lastmod><priority>0.8</priority></url>`,
    ),
  ].join('\n')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
})
