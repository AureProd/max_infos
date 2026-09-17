<script setup lang="ts">
import { frDate } from '#shared/utils/format'
import { mediaLabel, networkLabel } from '#shared/utils/social'

/**
 * Choosing the article a publication relates to.
 *
 * A `<select>` was the wrong tool: it carried full article titles, so the
 * column had to be wide enough for them — and it pushed the whole page off
 * screen, horizontal scrollbar and all.
 *
 * What replaced it could still only be searched by title, and showed
 * nothing of either side of the pairing. Rattacher is a decision about two
 * things at once: it now SHOWS the publication being attached — its image,
 * its network, its date — beside articles shown with their artwork and
 * their tags, and the search covers tags as it does on the home page.
 */
interface Choice {
  slug: string
  title: string
  status: string
  publishedAt: string | null
  coverUrl?: string | null
  tags?: { label: string; slug: string }[]
}

interface Publication {
  network: string
  caption?: string | null
  thumbnailUrl?: string | null
  mediaUrl?: string | null
  mediaType?: string | null
  permalink?: string | null
  postedAt?: string | null
  accountUsername?: string | null
}

const props = defineProps<{
  articles: Choice[]
  current: string | null
  publication?: Publication | null
}>()
const emit = defineEmits<{ close: []; choose: [slug: string] }>()

const search = ref('')
const tagFilter = ref<string | null>(null)

/** Les tags portés par au moins un article, les plus portés d'abord. */
const tags = computed(() => {
  const counts = new Map<string, { label: string; slug: string; n: number }>()
  for (const a of props.articles) {
    for (const t of a.tags ?? []) {
      const seen = counts.get(t.slug)
      if (seen) seen.n += 1
      else counts.set(t.slug, { ...t, n: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'fr'))
})

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return props.articles.filter((a) => {
    if (tagFilter.value && !(a.tags ?? []).some((t) => t.slug === tagFilter.value)) return false
    if (!q) return true
    // La recherche couvre les tags, comme sur l'accueil : on cherche un
    // article par son sujet au moins autant que par son titre.
    return (
      a.title.toLowerCase().includes(q) ||
      (a.tags ?? []).some((t) => t.label.toLowerCase().includes(q))
    )
  })
})

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="ac-backdrop" @click.self="emit('close')">
      <div class="ac-box admin-ui" role="dialog" aria-modal="true" aria-label="Choisir un article">
        <header class="ac-head">
          <h2>Rattacher à un article</h2>
          <Button
            severity="secondary"
            text
            icon="pi pi-times"
            aria-label="Fermer"
            @click="emit('close')"
          />
        </header>

        <div class="ac-split">
          <!-- Ce qu'on rattache. Il n'était désigné que par sa légende. -->
          <aside v-if="publication" class="ac-source">
            <div class="ac-source-media">
              <video
                v-if="publication.mediaUrl"
                :src="publication.mediaUrl"
                muted
                loop
                autoplay
                playsinline
              />
              <img v-else-if="publication.thumbnailUrl" :src="publication.thumbnailUrl" alt="" />
              <span v-else class="ac-source-nothumb">
                {{ mediaLabel(publication.mediaType ?? null) }}
              </span>
            </div>
            <div class="ac-source-meta">
              <span class="a-tag is-info">{{ networkLabel(publication.network) }}</span>
              <span v-if="publication.accountUsername">@{{ publication.accountUsername }}</span>
              <time v-if="publication.postedAt" :datetime="publication.postedAt">
                {{ frDate(publication.postedAt.slice(0, 10)) }}
              </time>
            </div>
            <p v-if="publication.caption" class="ac-source-caption">
              {{ publication.caption.slice(0, 220) }}
            </p>
            <a
              v-if="publication.permalink"
              class="a-btn"
              :href="publication.permalink"
              target="_blank"
              rel="noopener"
            >
              <i class="pi pi-external-link" aria-hidden="true" /> Voir la publication
            </a>
          </aside>

          <div class="ac-body">
            <IconField>
              <InputIcon class="pi pi-search" />
              <InputText
                v-model="search"
                type="search"
                placeholder="Chercher un titre ou un tag…"
                fluid
              />
            </IconField>

            <div v-if="tags.length" class="ac-tags" role="group" aria-label="Filtrer par tag">
              <button
                v-for="t in tags"
                :key="t.slug"
                class="tag"
                type="button"
                :aria-pressed="tagFilter === t.slug"
                @click="tagFilter = tagFilter === t.slug ? null : t.slug"
              >
                {{ t.label }}
              </button>
            </div>

            <button
              class="ac-row is-detach"
              type="button"
              :aria-pressed="current === null"
              @click="emit('choose', '')"
            >
              <span class="ac-title">— aucune —</span>
              <span class="ac-meta">Détacher cette publication</span>
            </button>

            <p v-if="!rows.length" class="a-empty">Aucun article ne correspond.</p>

            <button
              v-for="a in rows"
              :key="a.slug"
              class="ac-row"
              type="button"
              :aria-pressed="current === a.slug"
              @click="emit('choose', a.slug)"
            >
              <span class="ac-thumb">
                <img v-if="a.coverUrl" :src="a.coverUrl" alt="" loading="lazy" />
                <i v-else class="pi pi-image" aria-hidden="true" />
              </span>
              <span class="ac-text">
                <span class="ac-title">{{ a.title }}</span>
                <span class="ac-meta">
                  <span :class="['a-tag', a.status === 'published' ? 'is-ok' : 'is-draft']">
                    {{ a.status === 'published' ? 'publié' : 'brouillon' }}
                  </span>
                  <time v-if="a.publishedAt" :datetime="a.publishedAt">
                    {{ frDate(a.publishedAt.slice(0, 10)) }}
                  </time>
                  <span v-for="t in a.tags ?? []" :key="t.slug" class="ac-tag">{{ t.label }}</span>
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ac-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  /* 24px de chaque côté, sur 375, c'est un huitième de l'écran perdu. */
  padding: clamp(12px, 4vw, 24px);
  background: rgba(15, 18, 22, 0.5);
}
.ac-box {
  /* Plus large qu'avant : on montre deux choses à la fois, la publication
     et les articles, et 640px ne suffisaient plus. */
  width: min(980px, 100%);
  /* dvh, non vh : la barre d'adresse mobile est comptée dans vh, et la
     fenêtre dépassait donc sous le bord de l'écran. */
  max-height: min(86dvh, 100%);
  display: flex;
  flex-direction: column;
  background: var(--a-panel);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}
.ac-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px 14px 20px;
  border-bottom: 1px solid var(--a-line);
}
.ac-head h2 {
  margin: 0;
  font-size: 1.05rem;
}
.ac-split {
  display: grid;
  grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
  min-height: 0;
  flex: 1;
}
.ac-source {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-right: 1px solid var(--a-line);
  background: var(--a-bg);
  overflow-y: auto;
}
.ac-source-media {
  aspect-ratio: 4 / 5;
  border-radius: 10px;
  overflow: hidden;
  background: var(--a-panel);
  border: 1px solid var(--a-line);
  display: grid;
  place-items: center;
}
.ac-source-media img,
.ac-source-media video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.ac-source-nothumb {
  color: var(--a-faint);
  font-size: 0.82rem;
}
.ac-source-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--a-muted);
}
.ac-source-caption {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--a-muted);
}
.ac-body {
  padding: 16px 20px 20px;
  overflow-y: auto;
  min-width: 0;
}
.ac-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0;
}
.ac-tags .tag {
  font-size: 0.78rem;
  color: var(--a-muted);
  background: var(--a-panel);
  border: 1px solid var(--a-line-strong);
  border-radius: 999px;
  padding: 4px 11px;
  cursor: pointer;
}
.ac-tags .tag[aria-pressed='true'] {
  color: #fff;
  background: var(--a-accent);
  border-color: var(--a-accent);
}
.ac-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ac-row.is-detach {
  justify-content: space-between;
  margin-bottom: 6px;
}
.ac-row:hover {
  background: var(--a-bg);
}
.ac-row[aria-pressed='true'] {
  background: var(--a-accent-soft);
  border-color: var(--a-accent);
}
.ac-thumb {
  flex: none;
  width: 56px;
  height: 56px;
  border-radius: 7px;
  overflow: hidden;
  background: var(--a-bg);
  border: 1px solid var(--a-line);
  display: grid;
  place-items: center;
  color: var(--a-faint);
}
.ac-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.ac-text {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.ac-title {
  font-weight: 600;
  color: var(--a-text);
}
.ac-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--a-faint);
  font-size: 0.8rem;
}
.ac-tag {
  border: 1px solid var(--a-line);
  border-radius: 999px;
  padding: 1px 8px;
}

@media (max-width: 760px) {
  /* La publication passe au-dessus : côte à côte, ni l'une ni l'autre
     n'aurait la place d'être lue. */
  .ac-split {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
  .ac-source {
    flex-direction: row;
    align-items: flex-start;
    border-right: none;
    border-bottom: 1px solid var(--a-line);
    overflow: visible;
  }
  .ac-source-media {
    width: 92px;
    flex: none;
    aspect-ratio: 1;
  }
}
</style>
