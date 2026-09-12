<script setup>
import { ref, computed } from 'vue'
import { ARTICLES } from '@/data/content'
import { renderMarkdown } from '@/lib/markdown'
import { nb, countChars } from '@/lib/format'

/**
 * Aperçu du futur back-office. La prévisualisation est réelle ;
 * l'enregistrement sera branché sur l'API en phase de production.
 */
const source = ARTICLES[0]
const draft = ref({
  title: source.title,
  dek: source.dek,
  tags: source.tags.join(', '),
  body: source.body
})

const preview = computed(() => renderMarkdown(draft.value.body))
const length = computed(() => nb(countChars(draft.value.body)))
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <div class="admin-bar">
        <h1>Rédaction</h1>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
          <span class="pill">Aperçu du back-office</span>
          <button class="btn">Enregistrer le brouillon</button>
          <button class="btn btn-primary">Publier</button>
        </div>
      </div>

      <div class="editor">
        <div>
          <div class="field">
            <label for="a-title">Titre</label>
            <input id="a-title" v-model="draft.title" type="text" />
          </div>
          <div class="field">
            <label for="a-dek">Chapô</label>
            <input id="a-dek" v-model="draft.dek" type="text" />
          </div>
          <div class="field">
            <label for="a-tags">Sujets, séparés par des virgules</label>
            <input id="a-tags" v-model="draft.tags" type="text" />
          </div>
          <div class="field">
            <label for="a-body"
              >Texte <span class="count">— {{ length }} caractères</span></label
            >
            <textarea id="a-body" v-model="draft.body" spellcheck="false" />
          </div>
        </div>
        <div class="preview">
          <!-- eslint-disable-next-line vue/no-v-html -- aperçu Markdown ; sera assaini côté serveur (bleach) au lot 9 -->
          <div class="prose" v-html="preview" />
        </div>
      </div>
    </section>
  </div>
</template>
