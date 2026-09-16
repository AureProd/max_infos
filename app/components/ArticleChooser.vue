<script setup lang="ts">
import { frDate } from '#shared/utils/format'

/**
 * Choosing the article a publication relates to.
 *
 * A <select> was the wrong tool: it carried full article titles, so the
 * column had to be wide enough for them — and it pushed the whole page off
 * screen, horizontal scrollbar and all. It offered no search either, and
 * the titles were truncated by the browser.
 *
 * A window can be searched, shows the state of each article, and takes the
 * width it needs without deforming the table behind it.
 */
interface Choice {
  slug: string
  title: string
  status: string
  publishedAt: string | null
}

const props = defineProps<{ articles: Choice[]; current: string | null; caption?: string | null }>()
const emit = defineEmits<{ close: []; choose: [slug: string] }>()

const search = ref('')

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return props.articles.filter((a) => !q || a.title.toLowerCase().includes(q))
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
          <div>
            <h2>Rattacher à un article</h2>
            <p v-if="caption" class="ac-sub">{{ caption.slice(0, 90) }}</p>
          </div>
          <button class="a-btn" type="button" @click="emit('close')">Fermer ✕</button>
        </header>

        <div class="ac-body">
          <input
            v-model="search"
            class="a-input ac-search"
            type="search"
            placeholder="Rechercher un article…"
          />

          <button
            class="ac-row"
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
            <span class="ac-title">{{ a.title }}</span>
            <span class="ac-meta">
              <span :class="['a-tag', a.status === 'published' ? 'is-ok' : 'is-draft']">
                {{ a.status === 'published' ? 'publié' : 'brouillon' }}
              </span>
              <time v-if="a.publishedAt" :datetime="a.publishedAt">
                {{ frDate(a.publishedAt.slice(0, 10)) }}
              </time>
            </span>
          </button>
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
  padding: 24px;
  background: rgba(15, 18, 22, 0.5);
}
.ac-box {
  width: min(640px, 100%);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}
.ac-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid #e2e5ea;
}
.ac-head h2 {
  margin: 0;
  font-size: 1.05rem;
}
.ac-sub {
  margin: 4px 0 0;
  color: #5b6270;
  font-size: 0.85rem;
}
.ac-body {
  padding: 16px 20px 20px;
  overflow-y: auto;
}
.ac-search {
  width: 100%;
  margin-bottom: 12px;
}
.ac-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  padding: 11px 12px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ac-row:hover {
  background: #f6f7f9;
}
.ac-row[aria-pressed='true'] {
  background: #eaf0fe;
  border-color: #2462e9;
}
.ac-title {
  font-weight: 600;
  color: #1a1d23;
}
.ac-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #858c99;
  font-size: 0.82rem;
  white-space: nowrap;
}
</style>
