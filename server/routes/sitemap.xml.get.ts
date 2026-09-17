import { desc, eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'

const x = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/**
 * Sitemap: the public pages and the published articles.
 *
 * /admin and /login are NOT in it — they already carry `noindex`, and
 * listing them would amount to pointing at where to knock.
 */
export default defineEventHandler(async (event) => {
  const { public: pub } = useRuntimeConfig()
  const base = pub.baseUrl.replace(/\/+$/, '')

  const articles = await useDatabase()
    .select({ slug: article.slug, updatedAt: article.updatedAt })
    .from(article)
    .where(eq(article.status, 'published'))
    .orderBy(desc(article.publishedAt))

  const day = (d: Date): string => d.toISOString().slice(0, 10)

  const urls = [
    `  <url><loc>${x(base)}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${x(base)}/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
    `  <url><loc>${x(base)}/privacy</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>`,
    `  <url><loc>${x(base)}/legal</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>`,
    `  <url><loc>${x(base)}/terms</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>`,
    ...articles.map(
      (a) =>
        `  <url><loc>${x(base)}/article/${a.slug}</loc><lastmod>${day(a.updatedAt)}</lastmod><priority>0.8</priority></url>`,
    ),
  ].join('\n')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
})
