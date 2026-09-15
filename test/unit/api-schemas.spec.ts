import { describe, expect, it } from 'vitest'
import {
  listArticlesQuery,
  listSocialQuery,
  slugParam,
  userInvitation,
  userUpdate,
} from '#shared/schemas/api'

describe('listeArticlesQuery', () => {
  it('applies its defaults on a bare query', () => {
    expect(listArticlesQuery.parse({})).toEqual({ page: 1, size: 12 })
  })

  it('converts the numbers coming from the URL, which are strings', () => {
    expect(listArticlesQuery.parse({ page: '3', size: '5' })).toMatchObject({
      page: 3,
      size: 5,
    })
  })

  it('bounds the page size', () => {
    // Unbounded, `?size=100000` would load everything into memory.
    expect(() => listArticlesQuery.parse({ size: '500' })).toThrow()
    expect(() => listArticlesQuery.parse({ page: '0' })).toThrow()
  })

  it('refuses an oversized search', () => {
    expect(() => listArticlesQuery.parse({ q: 'x'.repeat(300) })).toThrow()
  })

  it('trims whitespace', () => {
    expect(listArticlesQuery.parse({ q: '  ia  ' }).q).toBe('ia')
  })
})

describe('listeSocialQuery', () => {
  it('accepts only the known networks', () => {
    expect(listSocialQuery.parse({ network: 'instagram' }).network).toBe('instagram')
    expect(() => listSocialQuery.parse({ network: 'mastodon' })).toThrow()
  })
})

describe('slugParam', () => {
  it('accepts a normal slug', () => {
    expect(slugParam.parse('controler-lia')).toBe('controler-lia')
  })

  it('refuses anything that is not a slug', () => {
    // The bound that counts: nothing that could look like a path.
    for (const wrong of ['../etc/passwd', 'Majuscule', 'deux--tirets', '-bord', 'bord-', 'a b']) {
      expect(() => slugParam.parse(wrong)).toThrow()
    }
  })
})

describe('inviting an account', () => {
  it('refuses anything that is not an address', () => {
    // The address is the JOIN KEY with Google: a malformed one creates a row
    // no login will ever match, and the person is told « ask JB » forever.
    for (const email of ['', 'max', 'max@', '@exemple.test', 'max exemple.test']) {
      expect(userInvitation.safeParse({ email, role: 'editor' }).success).toBe(false)
    }
  })

  it('accepts an ordinary address, trimmed', () => {
    const parsed = userInvitation.parse({ email: '  max@exemple.test  ', role: 'editor' })
    expect(parsed.email).toBe('max@exemple.test')
  })

  it('accepts the two roles and nothing else', () => {
    expect(userInvitation.parse({ email: 'a@b.test', role: 'tech' }).role).toBe('tech')
    expect(userInvitation.safeParse({ email: 'a@b.test', role: 'admin' }).success).toBe(false)
    expect(userInvitation.safeParse({ email: 'a@b.test' }).success).toBe(false)
  })
})

describe('updating an account', () => {
  it('accepts a single field, because that is what a switch sends', () => {
    // Posting the whole state back would overwrite a change made meanwhile.
    expect(userUpdate.parse({ active: false })).toEqual({ active: false })
    expect(userUpdate.parse({ role: 'tech' })).toEqual({ role: 'tech' })
  })

  it('refuses a role it does not know', () => {
    expect(userUpdate.safeParse({ role: 'superadmin' }).success).toBe(false)
  })

  it('accepts an empty change rather than failing on it', () => {
    // The route decides what to do with it; the schema is not the place to
    // say « you changed nothing ».
    expect(userUpdate.parse({})).toEqual({})
  })
})
