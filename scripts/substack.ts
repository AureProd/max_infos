/**
 * Migration initiale depuis Substack : couvertures et liens d'origine.
 *
 *   pnpm substack https://unmaxdinfo.substack.com/feed
 *   pnpm substack <url> --dry     n'écrit rien, montre ce qui serait fait
 *
 * Ce que ce script fait, et RIEN d'autre : rattacher chaque article déjà en
 * base à son billet Substack (`substack_url`) et lui donner sa cover
 * d'origine si elle lui manque. Il n'importe pas les corps de texte — le
 * flux les donne en HTML, les articles du site sont en Markdown, et une
 * conversion automatique produirait du balisage que Max devrait relire
 * article par article. Les billets sans correspondance sont donc SIGNALÉS,
 * pas créés : la décision reste à un humain.
 *
 * L'image n'est pas recopiée dans R2 : la ligne `media` porte l'URL du CDN
 * Substack et `r2_key` reste nulle, ce pour quoi cette colonne est
 * nullable. Contrepartie assumée et à connaître : si Max ferme un jour son
 * Substack, ces couvertures disparaissent — il suffira alors de les
 * retéléverser depuis l'écran d'édition.
 *
 * Idempotent : relancé, il ne réécrit que ce qui manque encore.
 */
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../server/database/schema'
import { analyserFluxSubstack } from '../server/utils/substack'
import { slugify } from '../shared/utils/slug'

const flux = process.argv[2]
const dryRun = process.argv.includes('--dry')

if (!flux?.startsWith('http')) {
  console.error(
    'Usage : pnpm substack <url du flux> [--dry]\nExemple : pnpm substack https://unmaxdinfo.substack.com/feed',
  )
  process.exit(1)
}

const URL_BASE = process.env.DATABASE_URL ?? process.env.NUXT_DATABASE_URL
if (!URL_BASE) {
  console.error('/!\\ DATABASE_URL manquante')
  process.exit(1)
}

const sqlClient = postgres(URL_BASE, { max: 1, onnotice: () => {} })
const db = drizzle(sqlClient, { schema, casing: 'snake_case' })

/** Le slug que Substack donne au billet : le dernier segment de l'URL. */
function slugSubstack(lien: string): string {
  return (
    lien
      .replace(/[?#].*$/, '')
      .replace(/\/$/, '')
      .split('/')
      .pop() ?? ''
  )
}

async function principal(): Promise<void> {
  const reponse = await fetch(flux as string, { headers: { accept: 'application/rss+xml' } })
  if (!reponse.ok) throw new Error(`Le flux a répondu ${reponse.status}`)

  const billets = analyserFluxSubstack(await reponse.text())
  console.log(`${billets.length} billet(s) dans le flux.\n`)

  const articles = await db
    .select({
      id: schema.article.id,
      slug: schema.article.slug,
      title: schema.article.title,
      substackUrl: schema.article.substackUrl,
      coverMediaId: schema.article.coverMediaId,
    })
    .from(schema.article)

  let lies = 0
  let couvertures = 0
  const orphelins: string[] = []

  for (const b of billets) {
    // Trois clés de rapprochement, de la plus sûre à la plus souple : le
    // lien déjà enregistré, le slug Substack, puis le titre slugifié.
    const cible =
      articles.find((a) => a.substackUrl === b.lien) ??
      articles.find((a) => a.slug === slugSubstack(b.lien)) ??
      articles.find((a) => slugify(a.title) === slugify(b.titre))

    if (!cible) {
      orphelins.push(`${b.titre} — ${b.lien}`)
      continue
    }

    if (!cible.substackUrl) {
      console.log(`  lien    ${cible.slug} → ${b.lien}`)
      if (!dryRun) {
        await db
          .update(schema.article)
          .set({ substackUrl: b.lien })
          .where(eq(schema.article.id, cible.id))
      }
      lies++
    }

    if (!cible.coverMediaId && b.cover) {
      console.log(`  couv.   ${cible.slug} → ${b.cover.slice(0, 70)}…`)
      if (!dryRun) {
        // Recherche avant insertion, et non `onConflictDoUpdate` : `url`
        // ne porte PAS d'index unique (seul `r2_key` en a un), et viser
        // une colonne sans contrainte fait échouer la requête à
        // l'exécution seulement. Relancer le script ne doit pas créer un
        // second média pour la même image.
        const [existant] = await db
          .select({ id: schema.media.id })
          .from(schema.media)
          .where(eq(schema.media.url, b.cover))
          .limit(1)

        const m =
          existant ??
          (
            await db
              .insert(schema.media)
              .values({
                r2Key: null,
                url: b.cover,
                mime: 'image/jpeg',
                bytes: 0,
                kind: 'image',
                alt: `Couverture de « ${b.titre} »`,
              })
              .returning({ id: schema.media.id })
          )[0]

        if (m) {
          await db
            .update(schema.article)
            .set({ coverMediaId: m.id })
            .where(eq(schema.article.id, cible.id))
        }
      }
      couvertures++
    }
  }

  // Les séquences ne bougent pas ici (aucun identifiant explicite inséré),
  // mais on le vérifie : une séquence désynchronisée casse le prochain
  // téléversement, et l'erreur ne parlerait pas de ce script.
  if (!dryRun) {
    await db.execute(
      sql`select setval(pg_get_serial_sequence('media', 'id'), coalesce((select max(id) from media), 1))`,
    )
  }

  console.log(`\n${lies} lien(s), ${couvertures} cover(s)${dryRun ? ' (essai à blanc)' : ''}.`)
  if (orphelins.length) {
    console.log(`\n${orphelins.length} billet(s) sans article correspondant, à créer à la main :`)
    for (const o of orphelins) console.log(`  - ${o}`)
  }
}

principal()
  .catch((e) => {
    console.error(`/!\\ ${(e as Error).message}`)
    process.exitCode = 1
  })
  .finally(() => sqlClient.end())
