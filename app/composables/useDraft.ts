import type { ArticleDraft } from '#shared/schemas/api'

interface Preview {
  html: string
  charCount: number
  readingMinutes: number
}

/**
 * L'édition d'un article : draft local, aperçu serveur, record.
 *
 * L'aperçu vient du SERVEUR, par le même engine que l'record. Un
 * rendered fait dans le navigateur finirait par diverger de ce qui est publié,
 * et Max verrait autre chose que ses lecteurs.
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
      // Débattu : on n'envoie pas une requête à chaque frappe.
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
    // On enregistre d'abord : publier un draft dont les dernières
    // modifications ne sont pas parties publierait l'ancienne version.
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
