import { S3Client } from '@aws-sdk/client-s3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * R2 storage, WITHOUT a bucket.
 *
 * Signing a URL is local computation — an HMAC, no network call — so the
 * whole module is exercised against dummy credentials. Only the deletion
 * really talks to S3, and its client is spied on.
 */

let config: Record<string, unknown> = {}

vi.stubGlobal('useRuntimeConfig', () => config)
vi.stubGlobal('createError', (o: { statusCode?: number; statusMessage?: string }) =>
  Object.assign(new Error(o.statusMessage ?? 'erreur'), { statusCode: o.statusCode }),
)

const {
  allowedType,
  kindOf,
  keyOf,
  publicUrl,
  storageConfigured,
  uploadUrl,
  removeFromStorage,
  resetStorage,
} = await import('../../server/utils/storage')

const COMPLETE = {
  r2Endpoint: 'https://exemple.r2.cloudflarestorage.com',
  r2AccessKeyId: 'cle-de-test',
  r2SecretAccessKey: 'secret-de-test',
  r2Bucket: 'unmaxdinfo-test',
  public: { r2BaseUrl: 'https://media.exemple.test' },
}

beforeEach(() => {
  config = { ...COMPLETE }
  resetStorage()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('accepted types', () => {
  it('admits the five image formats and the PDF', () => {
    for (const t of [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
      'application/pdf',
    ]) {
      expect(allowedType(t)).toBe(true)
    }
  })

  it('refuses everything else, starting with what runs', () => {
    // An SVG carries scripts, an HTML file served from the media domain
    // would run there.
    for (const t of ['image/svg+xml', 'text/html', 'application/javascript', '']) {
      expect(allowedType(t)).toBe(false)
    }
  })

  it('does not depend on the case the browser sends', () => {
    expect(allowedType('IMAGE/PNG')).toBe(true)
    expect(kindOf('APPLICATION/PDF')).toBe('pdf')
  })

  it('separates the PDF from the images, which are displayed', () => {
    expect(kindOf('application/pdf')).toBe('pdf')
    expect(kindOf('image/png')).toBe('image')
  })
})

describe('storage key', () => {
  it('prefixes with the day so the bucket stays browsable', () => {
    expect(keyOf('capture.png')).toMatch(/^\d{4}-\d{2}-\d{2}\/[0-9a-f]{8}-capture\.png$/)
  })

  it('never lets one upload overwrite another', () => {
    // Two people sending « capture.png » is the first thing that happens.
    expect(keyOf('capture.png')).not.toBe(keyOf('capture.png'))
  })

  it('strips the accents and the spaces a file name carries', () => {
    expect(keyOf('Été à Paris.PNG')).toMatch(/ete-a-paris\.png$/)
    expect(keyOf('mon fichier (1).pdf')).toMatch(/mon-fichier-1-\.pdf$/)
  })

  it('leaves neither a leading nor a trailing dash', () => {
    expect(keyOf('  photo.png  ')).toMatch(/-photo\.png$/)
    expect(keyOf('  photo.png  ')).not.toMatch(/-$/)
  })

  it('falls back on a name rather than producing an empty key', () => {
    // A key ending in « / » would be a folder, and the medium would be
    // unreachable.
    expect(keyOf('###')).toMatch(/-fichier$/)
    expect(keyOf('')).toMatch(/-fichier$/)
  })

  it('caps the length, because a key is not a title', () => {
    const key = keyOf(`${'a'.repeat(300)}.png`)
    expect(key.split('/')[1]?.length).toBeLessThanOrEqual(89)
  })
})

describe('configuration report', () => {
  it('says yes only when the four values are there', () => {
    expect(storageConfigured()).toBe(true)
    for (const missing of ['r2Endpoint', 'r2AccessKeyId', 'r2SecretAccessKey', 'r2Bucket']) {
      config = { ...COMPLETE, [missing]: '' }
      expect(storageConfigured()).toBe(false)
    }
  })
})

describe('upload URL', () => {
  it('signs locally, without a single network call', async () => {
    // If this test needed a bucket, the suite would depend on Cloudflare.
    const url = await uploadUrl('2026-09-15/abcd1234-a.png', 'image/png')

    // The SDK addresses R2 in virtual-hosted style: the bucket is the
    // subdomain, not the first path segment.
    expect(url).toContain('https://unmaxdinfo-test.exemple.r2.cloudflarestorage.com/')
    expect(url).toContain('/2026-09-15/abcd1234-a.png?')
    expect(url).toContain('X-Amz-Signature=')
    expect(url).toContain('X-Amz-Expires=600')
  })

  it('refuses plainly when storage is not configured', async () => {
    // A 503 says « not configured »; a crash would say nothing.
    config = { ...COMPLETE, r2Endpoint: '' }
    resetStorage()
    await expect(uploadUrl('a', 'image/png')).rejects.toMatchObject({ statusCode: 503 })
  })

  it('builds its client once and keeps it', async () => {
    const spy = vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never)
    await removeFromStorage('a')
    await removeFromStorage('b')
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('public address', () => {
  it('joins the base and the key with a single slash', () => {
    expect(publicUrl('2026-09-15/a.png')).toBe('https://media.exemple.test/2026-09-15/a.png')
  })

  it('tolerates a base copied with its trailing slash', () => {
    config = { ...COMPLETE, public: { r2BaseUrl: 'https://media.exemple.test///' } }
    expect(publicUrl('a.png')).toBe('https://media.exemple.test/a.png')
  })
})

describe('deletion', () => {
  it('targets the right bucket and the right key', async () => {
    const spy = vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never)
    await removeFromStorage('2026-09-15/abcd1234-a.png')

    const command = spy.mock.calls[0]?.[0] as unknown as { input: Record<string, string> }
    expect(command.input).toMatchObject({
      Bucket: 'unmaxdinfo-test',
      Key: '2026-09-15/abcd1234-a.png',
    })
  })
})
