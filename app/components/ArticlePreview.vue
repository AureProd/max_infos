<script setup lang="ts">
import { frDate } from '#shared/utils/format'

/**
 * The article as the visitor will see it, in a window.
 *
 * The side-by-side preview showed the body with the PUBLIC stylesheet —
 * dark — inside the light back-office: a mix that was neither pretty nor
 * faithful. Worse, it showed only the body: no cover, no title, no dek, so
 * it did not answer the only question it was there for, « what will this
 * look like? ».
 *
 * Teleported to <body>, therefore OUTSIDE .admin-shell: the site's own
 * rules apply, with no override. It is the real page, at reduced scale.
 */
defineProps<{
  title: string
  dek: string
  html: string
  coverUrl: string | null
  coverAlt?: string | null
  tags: string[]
  byline?: string
  publishedAt?: string | null
  readingMinutes: number
}>()

const emit = defineEmits<{ close: [] }>()

/** Escape closes: a preview is looked at, then dismissed. */
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="pv-backdrop" role="dialog" aria-modal="true" aria-label="Aperçu de l'article">
      <div class="pv-bar">
        <span class="pv-note">Aperçu — ce que verra le visiteur</span>
        <button class="pv-close" type="button" @click="emit('close')">Fermer ✕</button>
      </div>

      <div class="pv-page">
        <div class="wrap">
          <article class="article">
            <header>
              <h1>{{ title || 'Sans titre' }}</h1>
              <p v-if="dek" class="dek">{{ dek }}</p>
              <div class="meta">
                <span v-if="byline" class="byline">{{ byline }}</span>
                <time v-if="publishedAt" :datetime="publishedAt">le {{ frDate(publishedAt) }}</time>
                <span>{{ readingMinutes }} min de lecture</span>
                <span v-if="tags.length">{{ tags.join(', ') }}</span>
              </div>
            </header>

            <CoverImage
              :src="coverUrl"
              :seed="7"
              ratio="3 / 2"
              :alt="coverAlt ?? title"
            />

            <!--
              Le HTML vient du SERVEUR, rendu et assaini par le même moteur
              qu'à l'enregistrement : ce qui s'affiche ici est exactement ce
              qui sera publié. Rien d'assaini ne peut entrer en base, donc
              rien de non assaini ne peut en sortir.
            -->
            <div class="prose" v-html="html" />
          </article>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pv-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.55);
}
.pv-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 18px;
  background: #101317;
  border-bottom: 1px solid #2a2f38;
  color: #949ba4;
  font-family: var(--display);
  font-size: 0.85rem;
}
.pv-close {
  padding: 6px 12px;
  border: 1px solid #3a4049;
  border-radius: 7px;
  background: transparent;
  color: #dbdee1;
  font: inherit;
  cursor: pointer;
}
.pv-close:hover {
  border-color: #4a81f5;
  color: #4a81f5;
}
/*
 * La page elle-même, avec le fond du site : c'est la couleur qui fait
 * l'essentiel de la ressemblance.
 */
.pv-page {
  flex: 1;
  overflow-y: auto;
  background: var(--ink, #17191d);
  color: var(--text, #dbdee1);
}
</style>
