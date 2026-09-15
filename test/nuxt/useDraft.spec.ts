import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDraft } from '~/composables/useDraft'

/**
 * Editing an article.
 *
 * The preview comes from the SERVER, through the same engine as saving: a
 * rendering done in the browser would eventually drift from what is
 * published, and Max would see something other than his readers.
 */

const calls: string[] = []
let existing: Record<string, unknown> | null = null
let saveFails = false
let lastBody: unknown = null

registerEndpoint('/api/admin/articles/mon-article', {
  method: 'GET',
  handler: () => {
    calls.push('GET article')
    return existing
  },
})
registerEndpoint('/api/admin/preview', {
  method: 'POST',
  handler: async (event) => {
    calls.push('POST preview')
    const body = (await readBody(event)) as { bodyMd: string }
    return { html: `<p>${body.bodyMd}</p>`, charCount: body.bodyMd.length, readingMinutes: 1 }
  },
})
registerEndpoint('/api/admin/articles', {
  method: 'POST',
  handler: async (event) => {
    calls.push('POST article')
    if (saveFails) throw new Error('refusé')
    lastBody = await readBody(event)
    return { slug: 'article-cree' }
  },
})
registerEndpoint('/api/admin/articles/article-cree', {
  method: 'PUT',
  handler: async (event) => {
    calls.push('PUT article')
    if (saveFails) throw new Error('refusé')
    lastBody = await readBody(event)
    return {}
  },
})
registerEndpoint('/api/admin/articles/article-cree/status', {
  method: 'PUT',
  handler: async (event) => {
    calls.push('PUT status')
    lastBody = await readBody(event)
    return {}
  },
})

const settle = () => new Promise((r) => setTimeout(r, 50))

beforeEach(() => {
  calls.length = 0
  lastBody = null
  saveFails = false
  existing = {
    title: 'Mon article',
    dek: null,
    bodyMd: 'Le corps.',
    status: 'published',
    featured: false,
    seoTitle: null,
    seoDescription: null,
    substackUrl: null,
    coverMediaId: null,
    tags: [{ slug: 'geo', label: 'Géographie' }],
  }
})

describe('load', () => {
  it('asks for nothing on a new article', async () => {
    const { load } = useDraft(ref(null))
    await load()
    expect(calls).toEqual([])
  })

  it('maps the article onto the form, and asks for the preview', async () => {
    const { draft, status, modified, preview, load } = useDraft(ref('mon-article'))
    await load()

    // A null dek must become an empty string: a form field bound to null
    // shows the word « null ».
    expect(draft.value.dek).toBe('')
    // The tags become labels: that is what the field displays.
    expect(draft.value.tags).toEqual(['Géographie'])
    expect(status.value).toBe('published')
    expect(preview.value.html).toBe('<p>Le corps.</p>')
    // Loading is not editing.
    expect(modified.value).toBe(false)
    expect(calls).toEqual(['GET article', 'POST preview'])
  })
})

describe('the preview', () => {
  it('waits for the typing to stop before asking the server', async () => {
    vi.useFakeTimers()
    const { draft, preview } = useDraft(ref(null))

    draft.value.bodyMd = 'a'
    await nextTick()
    draft.value.bodyMd = 'ab'
    await nextTick()
    draft.value.bodyMd = 'abc'
    await nextTick()

    // Nothing yet: a request per keystroke would be one per letter typed.
    expect(calls).toEqual([])

    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()
    await settle()

    expect(calls).toEqual(['POST preview'])
    expect(preview.value.html).toBe('<p>abc</p>')
  })

  it('does not re-render when only the title or the tags change', async () => {
    // The preview shows the BODY: re-rendering on a title change would cost
    // a request for nothing.
    const { draft, modified } = useDraft(ref(null))

    draft.value.title = 'Un titre'
    draft.value.dek = 'Un chapô'
    draft.value.tags = ['IA']
    await nextTick()
    await settle()

    expect(modified.value).toBe(true)
    expect(calls).toEqual([])
  })
})

describe('save', () => {
  it('creates the article and picks up the slug the server chose', async () => {
    // The server frees the slug: keeping the one typed would collide.
    const slug = ref<string | null>(null)
    const { draft, record, save } = useDraft(slug)
    draft.value.title = 'Mon article'

    expect(await save()).toBe('article-cree')
    expect(slug.value).toBe('article-cree')
    expect(record.value).toBe('enregistré')
    expect(calls).toContain('POST article')
  })

  it('updates rather than creating once the slug is known', async () => {
    const { record, save } = useDraft(ref('article-cree'))
    await save()

    expect(calls).toEqual(['PUT article'])
    expect(record.value).toBe('enregistré')
  })

  it('clears the modified flag only on success', async () => {
    const { draft, modified, save } = useDraft(ref('article-cree'))
    draft.value.title = 'Modifié'
    await nextTick()
    expect(modified.value).toBe(true)

    await save()
    expect(modified.value).toBe(false)
  })

  it('says it failed rather than claiming a save that did not happen', async () => {
    saveFails = true
    const { draft, modified, record, save } = useDraft(ref('article-cree'))
    draft.value.title = 'Modifié'
    await nextTick()

    expect(await save()).toBeNull()
    expect(record.value).toBe('échec')
    // Still modified: the edits are only in the browser.
    expect(modified.value).toBe(true)
  })
})

describe('changeStatus', () => {
  it('saves BEFORE publishing, or it would publish the older version', async () => {
    const { draft, status, changeStatus } = useDraft(ref('article-cree'))
    draft.value.title = 'Modifié'
    await nextTick()

    await changeStatus('published')

    expect(calls).toEqual(['PUT article', 'PUT status'])
    expect(lastBody).toEqual({ status: 'published' })
    expect(status.value).toBe('published')
  })

  it('publishes without re-saving when nothing has changed', async () => {
    const { changeStatus } = useDraft(ref('article-cree'))
    await changeStatus('draft')
    expect(calls).toEqual(['PUT status'])
  })

  it('saves a new article first, then publishes it', async () => {
    const slug = ref<string | null>(null)
    const { changeStatus } = useDraft(slug)
    await changeStatus('published')

    expect(calls).toEqual(['POST article', 'PUT status'])
    expect(slug.value).toBe('article-cree')
  })

  it('touches the status when the save failed and there is nothing to publish', async () => {
    saveFails = true
    const slug = ref<string | null>(null)
    const { status, changeStatus } = useDraft(slug)

    await changeStatus('published')

    expect(calls).toEqual(['POST article'])
    expect(status.value).toBe('draft')
  })
})
