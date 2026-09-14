import type { BrouillonArticle } from '#shared/schemas/api'

interface Apercu {
  html: string
  charCount: number
  readingMinutes: number
}

/**
 * L'édition d'un article : brouillon local, aperçu serveur, enregistrement.
 *
 * L'aperçu vient du SERVEUR, par le même moteur que l'enregistrement. Un
 * rendu fait dans le navigateur finirait par diverger de ce qui est publié,
 * et Max verrait autre chose que ses lecteurs.
 */
export function useBrouillon(slug: Ref<string | null>) {
  const brouillon = ref<BrouillonArticle>({
    title: '',
    dek: '',
    bodyMd: '',
    tags: [],
    featured: false,
  })
  const apercu = ref<Apercu>({ html: '', charCount: 0, readingMinutes: 1 })
  const statut = ref<'draft' | 'published'>('draft')
  const enregistrement = ref<'repos' | 'en cours' | 'enregistré' | 'échec'>('repos')
  const modifie = ref(false)

  async function charger(): Promise<void> {
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
    }>(`/api/admin/articles/${slug.value}`)

    brouillon.value = {
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
    statut.value = a.status
    modifie.value = false
    await rafraichirApercu()
  }

  let minuteurApercu: ReturnType<typeof setTimeout> | undefined
  async function rafraichirApercu(): Promise<void> {
    apercu.value = await $fetch<Apercu>('/api/admin/preview', {
      method: 'POST',
      body: { bodyMd: brouillon.value.bodyMd },
    })
  }

  watch(
    () => brouillon.value.bodyMd,
    () => {
      modifie.value = true
      // Débattu : on n'envoie pas une requête à chaque frappe.
      clearTimeout(minuteurApercu)
      minuteurApercu = setTimeout(rafraichirApercu, 300)
    },
  )
  watch(
    () => [brouillon.value.title, brouillon.value.dek, brouillon.value.tags],
    () => {
      modifie.value = true
    },
    { deep: true },
  )

  async function enregistrer(): Promise<string | null> {
    enregistrement.value = 'en cours'
    try {
      if (!slug.value) {
        const cree = await $fetch<{ slug: string }>('/api/admin/articles', {
          method: 'POST',
          body: brouillon.value,
        })
        slug.value = cree.slug
      } else {
        await $fetch(`/api/admin/articles/${slug.value}`, {
          method: 'PUT',
          body: brouillon.value,
        })
      }
      enregistrement.value = 'enregistré'
      modifie.value = false
      return slug.value
    } catch {
      enregistrement.value = 'échec'
      return null
    }
  }

  async function changerStatut(vers: 'draft' | 'published'): Promise<void> {
    // On enregistre d'abord : publier un brouillon dont les dernières
    // modifications ne sont pas parties publierait l'ancienne version.
    if (modifie.value || !slug.value) await enregistrer()
    if (!slug.value) return
    await $fetch(`/api/admin/articles/${slug.value}/status`, {
      method: 'PUT',
      body: { status: vers },
    })
    statut.value = vers
  }

  return {
    brouillon,
    apercu,
    statut,
    enregistrement,
    modifie,
    charger,
    enregistrer,
    changerStatut,
  }
}
