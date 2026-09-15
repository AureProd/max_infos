import { eq } from 'drizzle-orm'
import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connection, database, migrate, type TestDatabase } from '../setup/db'

/**
 * The article helpers, against a REAL database.
 *
 * `freeSlug` loops against the unique index and `replaceTags` relies on two
 * conflict clauses: a faked query builder would prove none of it.
 */

let sqlClient: postgres.Sql
let db: TestDatabase

vi.mock('~~/server/database/client', () => ({ useDatabase: () => db }))
vi.stubGlobal('createError', (o: { statusCode?: number; statusMessage?: string }) =>
  Object.assign(new Error(o.statusMessage ?? 'erreur'), { statusCode: o.statusCode }),
)

const { replaceTags, freeSlug, cleanOrphanTags, tagsOf } = await import(
  '../../server/utils/articles'
)
const { article, articleTag, tag } = await import('../../server/database/schema')

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

beforeEach(async () => {
  await sqlClient.unsafe('truncate table article_tag, article, tag restart identity cascade')
})

const newArticle = async (slug: string) => {
  const [row] = await db.insert(article).values({ slug, title: slug }).returning({ id: article.id })
  return row?.id ?? 0
}

const labelsOf = async (id: number) => (await tagsOf(id)).map((t) => t.label).sort()

describe('replaceTags', () => {
  it('creates the missing tags and attaches them', async () => {
    const id = await newArticle('a')
    await replaceTags(id, ['Géopolitique', 'IA'])
    expect(await labelsOf(id)).toEqual(['Géopolitique', 'IA'])
  })

  it('deduplicates and trims what the form sends', async () => {
    // The tag field is free text: « IA », « ia » and « IA » are one tag.
    const id = await newArticle('a')
    await replaceTags(id, [' IA ', 'ia', 'IA', ''])
    expect(await tagsOf(id)).toHaveLength(1)
  })

  it('replaces the whole set rather than adding to it', async () => {
    // That is what a form where you REMOVE a tag expects.
    const id = await newArticle('a')
    await replaceTags(id, ['A', 'B'])
    await replaceTags(id, ['B'])
    expect(await labelsOf(id)).toEqual(['B'])
  })

  it('leaves the orphaned tag alive: its colour was chosen by hand', async () => {
    const id = await newArticle('a')
    await replaceTags(id, ['A', 'B'])
    await replaceTags(id, ['B'])
    expect(await db.select().from(tag)).toHaveLength(2)
  })

  it('detaches everything on an empty list', async () => {
    const id = await newArticle('a')
    await replaceTags(id, ['A'])
    await replaceTags(id, [])
    expect(await tagsOf(id)).toEqual([])
  })

  it('is idempotent, so saving twice changes nothing', async () => {
    const id = await newArticle('a')
    await replaceTags(id, ['A', 'B'])
    await replaceTags(id, ['A', 'B'])
    expect(await tagsOf(id)).toHaveLength(2)
  })

  it('touches no other article', async () => {
    const one = await newArticle('a')
    const two = await newArticle('b')
    await replaceTags(one, ['A'])
    await replaceTags(two, ['B'])
    await replaceTags(one, [])
    expect(await labelsOf(two)).toEqual(['B'])
  })
})

describe('freeSlug', () => {
  it('gives the plain slug when the title is free', async () => {
    expect(await freeSlug('Sport et pouvoir')).toBe('sport-et-pouvoir')
  })

  it('shifts to -2 when it is taken', async () => {
    // Without this, two close titles would throw a constraint violation in
    // Max's face, and he can do nothing about it.
    await newArticle('sport-et-pouvoir')
    expect(await freeSlug('Sport et pouvoir')).toBe('sport-et-pouvoir-2')
  })

  it('keeps an article its own slug when it is being edited', async () => {
    const id = await newArticle('sport-et-pouvoir')
    expect(await freeSlug('Sport et pouvoir', id)).toBe('sport-et-pouvoir')
  })

  it('keeps counting past the second', async () => {
    await newArticle('a')
    await newArticle('a-2')
    await newArticle('a-3')
    expect(await freeSlug('A')).toBe('a-4')
  })

  it('shifts a reserved slug without even asking the database', async () => {
    // `home` is a back-office screen: an article on that slug would be
    // unreachable, since static routes win over dynamic ones.
    expect(await freeSlug('Home')).toBe('home-2')
    expect(await db.select().from(article)).toHaveLength(0)
  })

  it('falls back on a name when the title yields nothing', async () => {
    expect(await freeSlug('!!!')).toBe('article')
  })
})

describe('cleanOrphanTags', () => {
  it('deletes only the tags no article carries', async () => {
    const id = await newArticle('a')
    await replaceTags(id, ['Gardé'])
    await db.insert(tag).values({ slug: 'orphelin', label: 'Orphelin' })

    expect(await cleanOrphanTags()).toBe(1)
    expect((await db.select().from(tag)).map((t) => t.label)).toEqual(['Gardé'])
  })

  it('reports zero when there is nothing to clean', async () => {
    expect(await cleanOrphanTags()).toBe(0)
  })
})

describe('tagsOf', () => {
  it('gives back the slug and the label of each attached tag', async () => {
    const id = await newArticle('a')
    await replaceTags(id, ['Géopolitique'])
    expect(await tagsOf(id)).toEqual([{ slug: 'geopolitique', label: 'Géopolitique' }])
  })

  it('gives back nothing for an article without tags', async () => {
    expect(await tagsOf(await newArticle('a'))).toEqual([])
  })

  it("does not leak another article's tags", async () => {
    const one = await newArticle('a')
    const two = await newArticle('b')
    await replaceTags(one, ['A'])
    await replaceTags(two, ['B'])
    expect(await labelsOf(one)).toEqual(['A'])
  })
})

describe('the link table', () => {
  it('disappears with its article', async () => {
    // The cascade is what keeps orphaned links from piling up.
    const id = await newArticle('a')
    await replaceTags(id, ['A'])
    await db.delete(article).where(eq(article.id, id))
    expect(await db.select().from(articleTag)).toHaveLength(0)
  })
})
