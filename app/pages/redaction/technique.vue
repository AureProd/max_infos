<script setup lang="ts">
definePageMeta({ middleware: 'redaction' })

const { peut } = useUtilisateur()
const voitLaTechnique = peut('tech')

// Le serveur refuse de toute façon : cet appel échouerait en 403 pour un
// compte `editor`. La garde ci-dessous évite seulement d'afficher une page
// d'erreur à quelqu'un qui n'a rien demandé.
const { data: comptes, error } = await useFetch('/api/admin/users', {
  key: 'admin-users',
  immediate: false,
})

watchEffect(() => {
  if (voitLaTechnique.value && !comptes.value && !error.value) refreshNuxtData('admin-users')
})

useSeoMeta({ title: 'Technique', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <div class="admin-bar">
        <h1>Technique</h1>
        <NuxtLink class="btn" to="/redaction">← Rédaction</NuxtLink>
      </div>

      <p v-if="!voitLaTechnique" class="empty">
        Cet écran est réservé au rôle technique.
      </p>

      <template v-else>
        <h2>Comptes autorisés</h2>
        <ul class="list">
          <li v-for="c in comptes ?? []" :key="c.id">
            <div class="entry">
              <div>
                <h3>{{ c.name ?? c.email }}</h3>
                <div class="meta">
                  <span>{{ c.email }}</span>
                  <span>{{ c.role }}</span>
                  <span>{{ c.active ? 'actif' : 'désactivé' }}</span>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>
