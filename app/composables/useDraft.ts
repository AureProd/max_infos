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
  const draft = ref<ArticleDraft>({
    title: '',
    dek: '',
    bodyMd: '',
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
      bodyMd: string
      status: 'draft' | 'published'
      featured: boolean
      seoTitle: string | null
      seoDescription: string | null
      substackUrl: string | null
      coverMediaId: number | null
      tags: { slug: string; label: string }[]
    }>(`/api/admin/articles/${slug.value}`, { headers: sessionHeaders() })

    draft.value = {
      title: a.title,
      dek: a.dek ?? '',
      bodyMd: a.bodyMd,
      tags: a.tags.map((t) => t.label),
      featured: a.featured,
      seoTitle: a.seoTitle,
      seoDescription: a.seoDescription,
      substackUrl: a.substackUrl,
      coverMediaId: a.coverMediaId,
    }
    status.value = a.status
    modified.value = false
    await refreshPreview()
  }

  let previewTimer: ReturnType<typeof setTimeout> | undefined
  async function refreshPreview(): Promise<void> {
    preview.value = await $fetch<Preview>('/api/admin/preview', {
      method: 'POST',
      body: { bodyMd: draft.value.bodyMd },
      headers: sessionHeaders(),
    })
  }

  watch(
    () => draft.value.bodyMd,
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
