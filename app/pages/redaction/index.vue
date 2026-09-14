<script setup lang="ts">
import { frDate } from '#shared/utils/format'

definePageMeta({ middleware: 'redaction' })

const { utilisateur, peut, deconnecter } = useUtilisateur()
// Ce qui relève de l'infrastructure n'apparaît pas dans le menu de Max.
// Ce masquage est du confort : la sécurité est le refus du serveur.
const voitLaTechnique = peut('tech')

const { data: articles, refresh } = await useFetch('/api/admin/articles', { key: 'admin-liste' })

async function creer(): Promise<void> {
  const cree = await $fetch<{ slug: string }>('/api/admin/articles', {
    method: 'POST',
    body: { title: 'Nouvel article', bodyMd: '', tags: [] },
  })
  await navigateTo(`/redaction/${cree.slug}`)
}

async function supprimer(slug: string, titre: string): Promise<void> {
  if (!confirm(`Supprimer « ${titre} » ? Cette action est définitive.`)) return
  await $fetch(`/api/admin/articles/${slug}`, { method: 'DELETE' })
  await refresh()
}

useSeoMeta({ title: 'Rédaction', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <div class="admin-bar">
        <h1>Rédaction</h1>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
          <span class="pill">{{ utilisateur?.name ?? utilisateur?.email }}</span>
          <NuxtLink v-if="voitLaTechnique" class="btn" to="/redaction/technique">
            Technique
          </NuxtLink>
          <button class="btn btn-primary" type="button" @click="creer">Nouvel article</button>
          <button class="btn" type="button" @click="deconnecter">Se déconnecter</button>
        </div>
      </div>

      <p v-if="!articles?.length" class="empty">
        Aucun article pour l'instant. Commence par en créer un.
      </p>

      <ul v-else class="list">
        <li v-for="a in articles" :key="a.slug">
          <div class="entry">
            <div>
              <h3>
                <NuxtLink :to="`/redaction/${a.slug}`">{{ a.title }}</NuxtLink>
              </h3>
              <div class="meta">
                <span class="pill">{{ a.status === 'published' ? 'publié' : 'brouillon' }}</span>
                <time v-if="a.publishedAt" :datetime="a.publishedAt">
                  {{ frDate(a.publishedAt.slice(0, 10)) }}
                </time>
                <span>modifié le {{ frDate(a.updatedAt.slice(0, 10)) }}</span>
              </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center">
              <NuxtLink
                v-if="a.status === 'published'"
                class="btn"
                :to="`/article/${a.slug}`"
                target="_blank"
              >
                Voir ↗
              </NuxtLink>
              <button class="btn" type="button" @click="supprimer(a.slug, a.title)">
                Supprimer
              </button>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
