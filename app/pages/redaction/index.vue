<script setup lang="ts">
import { countChars, nb } from '#shared/utils/format'
import { renderMarkdown } from '#shared/utils/markdown'
import { ARTICLES } from '~/data/content'

/**
 * Aperçu du futur back-office. La prévisualisation est réelle ;
 * l'enregistrement sera branché sur l'API au lot 5.
 *
 * Cette page n'est PAS protégée : elle ne fait que manipuler des données en
 * dur, côté navigateur. La garde de route et les rôles arrivent au lot 4.
 */
const source = ARTICLES[0]
const draft = ref({
  title: source?.title ?? '',
  dek: source?.dek ?? '',
  tags: source?.tags.join(', ') ?? '',
  body: source?.body ?? '',
})

const preview = computed(() => renderMarkdown(draft.value.body))
const length = computed(() => nb(countChars(draft.value.body)))

useSeoMeta({ title: 'Rédaction', robots: 'noindex, nofollow' })
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
          <!--
            v-html de l'aperçu Markdown, même moteur que la page d'article.
            Disparaît au lot 5, remplacé par un appel à l'API qui renverra
            du HTML déjà assaini côté serveur.
          -->
          <div class="prose" v-html="preview" />
        </div>
      </div>
    </section>
  </div>
</template>
