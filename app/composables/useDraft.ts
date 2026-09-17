import type { ArticleDraft } from '#shared/schemas/api'

interface Preview {
  html: string
  charCount: number
  readingMinutes: number
}

/**
 * Editing an article: local draft, server preview, saving.
 *
 * The preview comes from the SERVER, through the same engine as saving. A
 * rendering done in the browser would eventually drift from what is
 * published, and Max would see something other than his readers.
 */
export function useDraft(slug: Ref<string | null>) {
  /*
   * Les en-têtes de session, capturées UNE FOIS, ici.
   *
   * `sessionHeaders()` appelle `useRequestHeaders()`, qui a besoin de
   * l'instance Nuxt. Appelée depuis `refreshPreview()` — donc après un
   * `await` dans une fonction ordinaire —, elle tombait sur « Nuxt instance
   * unavailable » (NUXT_E1001) et l'écran d'édition sortait en 500. De
   * façon intermittente : le contexte survit parfois à un await, selon ce
   * qui s'est exécuté entre-temps. Ici le composable est appelé dans le
   * `setup`, où le contexte est garanti.
   */
  const headers = sessionHeaders()

  const draft = ref<ArticleDraft>({
    title: '',
    dek: '',
    bodyHtml: '',
    tags: [],
    featured: false,
  })
  const preview = ref<Preview>({ html: '', charCount: 0, readingMinutes: 1 })
  const status = ref<'draft' | 'published'>('draft')
  const record = ref<'repos' | 'en cours' | 'enregistré' | 'échec'>('repos')
  const modified = ref(false)

  async function load(): Promise<void> {
    if (!slug.value) return
    const a = await $fetch<{
      title: string
      dek: string | null
      bodyHtml: string
      status: 'draft' | 'published'
      featured: boolean
      seoTitle: string | null
      seoDescription: string | null
      substackUrl: string | null
      coverMediaId: number | null
      tags: { slug: string; label: string }[]
    }>(`/api/admin/articles/${slug.value}`, { headers })

    draft.value = {
      title: a.title,
      dek: a.dek ?? '',
      bodyHtml: a.bodyHtml,
      tags: a.tags.map((t) => t.label),
      featured: a.featured,
      seoTitle: a.seoTitle,
      seoDescription: a.seoDescription,
      substackUrl: a.substackUrl,
      coverMediaId: a.coverMediaId,
    }
    status.value = a.status
    await refreshPreview()

    // AFTER the watchers, not before: they fire on the next tick, so an
    // assignment made here would be overwritten and the form would claim
    // unsaved edits on an article just opened — and publishing would save
    // for nothing. The pending preview is dropped along the way: it has
    // just been fetched.
    await nextTick()
    clearTimeout(previewTimer)
    modified.value = false
  }

  let previewTimer: ReturnType<typeof setTimeout> | undefined
  async function refreshPreview(): Promise<void> {
    preview.value = await $fetch<Preview>('/api/admin/preview', {
      method: 'POST',
      body: { bodyHtml: draft.value.bodyHtml },
      headers,
    })
  }

  watch(
    () => draft.value.bodyHtml,
    () => {
      modified.value = true
      // Debounced: we do not send a request on every keystroke.
      clearTimeout(previewTimer)
      previewTimer = setTimeout(refreshPreview, 300)
    },
  )
  watch(
    () => [draft.value.title, draft.value.dek, draft.value.tags],
    () => {
      modified.value = true
    },
    { deep: true },
  )

  async function save(): Promise<string | null> {
    record.value = 'en cours'
    try {
      if (!slug.value) {
        const created = await $fetch<{ slug: string }>('/api/admin/articles', {
          method: 'POST',
          body: draft.value,
        })
        slug.value = created.slug
      } else {
        await $fetch(`/api/admin/articles/${slug.value}`, {
          method: 'PUT',
          body: draft.value,
        })
      }
      record.value = 'enregistré'
      modified.value = false
      return slug.value
    } catch {
      record.value = 'échec'
      return null
    }
  }

  async function changeStatus(vers: 'draft' | 'published'): Promise<void> {
    // Save first: publishing a draft whose latest edits have not been sent
    // would publish the older version.
    if (modified.value || !slug.value) await save()
    if (!slug.value) return
    await $fetch(`/api/admin/articles/${slug.value}/status`, {
      method: 'PUT',
      body: { status: vers },
    })
    status.value = vers
  }

  return {
    draft,
    preview,
    status,
    record,
    modified,
    load,
    save,
    changeStatus,
  }
}
