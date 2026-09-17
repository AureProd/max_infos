<script setup lang="ts">
import { frDate } from '#shared/utils/format'
import { mediaLabel, networkLabel } from '#shared/utils/social'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const { data: publications, refresh } = await useFetch('/api/admin/social-posts', {
  key: 'admin-publications',
})
const { data: articles } = await useFetch('/api/admin/articles', { key: 'admin-articles-liste' })
const { data: linked } = await useFetch('/api/social-posts', { key: 'publications-liees' })

/** Posts discovered and not yet attached: the work left to do. */
const toAttach = computed(
  () => (publications.value ?? []).filter((p) => !p.hidden && !p.articleSlug).length,
)

/**
 * The per-account filter.
 *
 * Purely local: the list is already loaded, and sorting it server-side
 * would cost a request per click.
 */
const filterCount = ref('')

const accounts = computed(() => {
  const vus = new Map<number, string>()
  for (const p of publications.value ?? []) {
    if (p.accountId && p.accountUsername) vus.set(p.accountId, p.accountUsername)
  }
  return [...vus].map(([id, username]) => ({ id, username }))
})

const visible = computed(() =>
  filterCount.value === ''
    ? (publications.value ?? [])
    : (publications.value ?? []).filter((p) => String(p.accountId ?? '') === filterCount.value),
)

async function attach(id: number, slug: string): Promise<void> {
  await $fetch(`/api/admin/social-posts/${id}/article`, {
    method: 'PUT',
    body: { articleSlug: slug || null },
  })
  await refresh()
}

async function toggleVisibility(id: number, hidden: boolean): Promise<void> {
  await $fetch(`/api/admin/social-posts/${id}/visibility`, { method: 'PUT', body: { hidden } })
  await refresh()
}

async function remove(id: number): Promise<void> {
  if (!confirm('Supprimer cette publication ? Cette action est définitive.')) return
  await $fetch(`/api/admin/social-posts/${id}`, { method: 'DELETE' })
  await refresh()
}

// --- Manual entry ----------------------------------------------------------
const BLANK = {
  network: 'linkedin' as 'linkedin' | 'instagram',
  url: '',
  caption: '',
  thumbnailUrl: '',
}

const input = ref({ ...BLANK })
const inputError = ref('')

/**
 * What the pasted page says about itself.
 *
 * No API will ever hand over a LinkedIn post — `r_member_social` is closed
 * to new applications — so the card arrived with neither title nor image.
 * The server reads the OpenGraph tags of the link instead. LinkedIn serves
 * them unevenly: when it says nothing, the two fields simply stay there,
 * empty and editable, which is why they are always shown.
 */
const reading = ref(false)
const readingSaid = ref('')

async function readLink(): Promise<void> {
  const url = input.value.url.trim()
  if (!url) return
  reading.value = true
  readingSaid.value = ''
  try {
    const found = await $fetch('/api/admin/social-posts/unfurl', { method: 'POST', body: { url } })
    if (found.title && !input.value.caption) input.value.caption = found.title
    if (found.image && !input.value.thumbnailUrl) input.value.thumbnailUrl = found.image
    readingSaid.value =
      found.title || found.image
        ? 'Lu depuis la page.'
        : 'Cette page ne dit rien d’exploitable : à remplir à la main.'
  } finally {
    reading.value = false
  }
}

async function add(): Promise<void> {
  inputError.value = ''
  try {
    await $fetch('/api/admin/social-posts', {
      method: 'POST',
      body: {
        network: input.value.network,
        url: input.value.url,
        // Empty strings would fail the URL and length checks: absent means
        // absent.
        caption: input.value.caption || undefined,
        thumbnailUrl: input.value.thumbnailUrl || undefined,
      },
    })
    input.value = { ...BLANK }
    readingSaid.value = ''
    await refresh()
  } catch (e) {
    inputError.value = (e as { statusMessage?: string }).statusMessage ?? 'Adresse non reconnue.'
  }
}

/**
 * The publication whose article is being chosen.
 *
 * A window rather than a <select>: the select carried whole article titles,
 * so it stretched its column until the page itself scrolled sideways, and
 * it could neither be searched nor show the state of each article.
 */
const chooserFor = ref<number | null>(null)

const titleOf = (slug: string): string =>
  (articles.value ?? []).find((a) => a.slug === slug)?.title ?? slug

async function chooseArticle(id: number, slug: string): Promise<void> {
  chooserFor.value = null
  await attach(id, slug)
}

useSeoMeta({ title: 'Publications', robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <div class="admin-title">
      <div>
        <h1>Publications</h1>
        <p class="admin-lede">
          {{ linked?.length ?? 0 }} visible(s) sur le site<template v-if="toAttach">
            · {{ toAttach }} découverte(s) sans article rattaché</template
          >
        </p>
      </div>
    </div>

      <!--
        La saisie manuelle est la SEULE voie pour LinkedIn : lire ses propres
        publications y est impossible, le scope r_member_social étant fermé
        aux nouvelles applications.
      -->
    <div class="admin-card" style="margin-bottom: 20px">
      <form @submit.prevent="add">
        <label class="a-label" for="p-url">Coller l'adresse d'une publication</label>
        <div class="a-toolbar">
          <select v-model="input.network" class="a-select" aria-label="Réseau">
            <option value="linkedin">LinkedIn</option>
            <option value="instagram">Instagram</option>
          </select>
          <input
            id="p-url"
            v-model="input.url"
            class="a-input"
            type="url"
            placeholder="https://www.linkedin.com/posts/…"
            required
            @blur="readLink"
          />
          <Button
            severity="secondary"
            outlined
            type="button"
            :label="reading ? 'Lecture…' : 'Lire la page'"
            :disabled="reading || !input.url"
            @click="readLink"
          />
          <button class="a-btn a-btn-primary" type="submit">Ajouter</button>
        </div>

        <!--
          Toujours affichés, jamais seulement en cas d'échec : LinkedIn ne
          sert ses balises qu'une fois sur deux, et un champ qui apparaît
          par surprise se remarque moins qu'un champ vide qui attend.
        -->
        <div class="a-row-grid is-cv" style="margin-top: 12px">
          <input
            v-model="input.caption"
            class="a-input"
            type="text"
            placeholder="Titre ou légende"
          />
          <input
            v-model="input.thumbnailUrl"
            class="a-input"
            type="url"
            placeholder="Adresse de l'image (facultative)"
          />
        </div>

        <p v-if="readingSaid" class="hint">{{ readingSaid }}</p>
        <p v-if="inputError" class="a-err">{{ inputError }}</p>
      </form>
    </div>

    <div class="admin-card">
      <div v-if="accounts.length > 1" class="a-toolbar">
        <select id="p-compte" v-model="filterCount" class="a-select" aria-label="Compte">
          <option value="">— tous les comptes —</option>
          <option v-for="c in accounts" :key="c.id" :value="String(c.id)">@{{ c.username }}</option>
        </select>
      </div>

      <p v-if="!publications?.length" class="a-empty">Aucune publication pour l'instant.</p>

      <table v-else class="a-table">
        <thead>
          <tr>
            <th>Publication</th>
            <th class="a-col-state">Réseau</th>
            <th class="a-col-date">Publiée le</th>
            <th>Article rattaché</th>
            <th class="a-col-act"><span class="a-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in visible" :key="p.id">
            <td>
              <!--
                La vignette, le compte et la légende : l'écran n'affichait
                qu'un identifiant brut (« instagram DdGUF5XJbhE »), qui ne
                permet pas de reconnaître la publication qu'on rattache.
              -->
              <div class="a-pub">
                <div class="a-pub-thumb">
                  <img v-if="p.thumbnailUrl" :src="p.thumbnailUrl" alt="" loading="lazy" />
                  <span v-else class="a-pub-nothumb">{{ mediaLabel(p.mediaType) }}</span>
                </div>
                <div class="a-pub-text">
                  <a
                    v-if="p.permalink"
                    class="a-title"
                    :href="p.permalink"
                    target="_blank"
                    rel="noopener"
                  >
                    {{ p.caption?.slice(0, 90) || mediaLabel(p.mediaType) }} ↗
                  </a>
                  <span v-else class="a-title">
                    {{ p.caption?.slice(0, 90) || mediaLabel(p.mediaType) }}
                  </span>
                  <div class="a-sub">
                    <span v-if="p.accountUsername">@{{ p.accountUsername }}</span>
                    <span>{{ mediaLabel(p.mediaType) }}</span>
                    <span>{{ p.source === 'api' ? 'découverte' : 'saisie' }}</span>
                    <span v-if="p.mediaUrl" class="a-tag is-info">vidéo</span>
                    <span v-if="p.hidden" class="a-tag is-draft">masquée</span>
                  </div>
                </div>
              </div>
            </td>
            <td>
              <span class="a-tag is-info">{{ networkLabel(p.network) }}</span>
            </td>
            <td class="a-date">
              <time v-if="p.postedAt" :datetime="p.postedAt">
                {{ frDate(p.postedAt.slice(0, 10)) }}
              </time>
              <span v-else class="a-nil">—</span>
            </td>
            <td>
              <button class="a-link-btn" type="button" @click="chooserFor = p.id">
                <template v-if="p.articleSlug">
                  {{ titleOf(p.articleSlug) }}
                </template>
                <span v-else class="a-nil">— rattacher —</span>
              </button>
            </td>
            <td>
              <div class="a-row-act">
                <button class="a-btn" type="button" @click="toggleVisibility(p.id, !p.hidden)">
                  {{ p.hidden ? 'Afficher' : 'Masquer' }}
                </button>
                <button class="a-btn a-btn-danger" type="button" @click="remove(p.id)">
                  Supprimer
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ArticleChooser
      v-if="chooserFor !== null"
      :articles="articles ?? []"
      :current="(publications ?? []).find((p) => p.id === chooserFor)?.articleSlug ?? null"
      :caption="(publications ?? []).find((p) => p.id === chooserFor)?.caption"
      @close="chooserFor = null"
      @choose="(slug) => chooseArticle(chooserFor as number, slug)"
    />
  </div>
</template>
