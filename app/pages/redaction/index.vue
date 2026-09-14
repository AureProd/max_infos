<script setup lang="ts">
import { frDate } from '#shared/utils/format'

definePageMeta({ middleware: 'redaction' })

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
      <AdminNav>
        <button class="btn btn-primary" type="button" @click="creer">Nouvel article</button>
      </AdminNav>

      <h1>Articles</h1>

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
