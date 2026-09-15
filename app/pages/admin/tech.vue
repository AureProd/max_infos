<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const { peut } = useUser()
const seesTech = peut('tech')

// Le serveur refuse de toute façon : cet call échouerait en 403 pour un
// account `editor`. La garde ci-dessous évite seulement d'afficher une page
// d'error à quelqu'un qui n'a rien demandé.
const { data: accounts, error } = await useFetch('/api/admin/users', {
  key: 'admin-users',
  immediate: false,
})

watchEffect(() => {
  if (seesTech.value && !accounts.value && !error.value) refreshNuxtData('admin-users')
})

const importState = ref<'repos' | 'en cours' | 'échec'>('repos')
const importMessage = ref('')

/**
 * L'import se fait TOUJOURS en simulation d'abord.
 *
 * Restaurer une sauvegarde écrase le content : proposer le bouton sans
 * montrer le différentiel reviendrait à demander à quelqu'un de signer
 * sans read.
 */
async function stub(evenement: Event): Promise<void> {
  const file = (evenement.target as HTMLInputElement).files?.[0]
  if (!file) return
  importState.value = 'en cours'
  importMessage.value = ''
  try {
    const archive = JSON.parse(await file.text())
    const summary = await $fetch('/api/admin/import', {
      method: 'POST',
      body: { archive, simulation: true },
    })
    importState.value = 'repos'
    importMessage.value =
      'simulation' in summary && summary.simulation
        ? `En base : ${JSON.stringify(summary.before)} — dans l'archive : ${JSON.stringify(summary.after)}`
        : 'Import appliqué.'
  } catch (e) {
    importState.value = 'échec'
    importMessage.value =
      (e as { statusMessage?: string }).statusMessage ?? 'Fichier illisible : attendu du JSON'
  }
}

useSeoMeta({ title: 'Technique', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <AdminNav />

      <h1>Technique</h1>

      <p v-if="!seesTech" class="empty">
        Cet écran est réservé au rôle technique.
      </p>

      <template v-else>
        <!--
          Instagram n'est plus ici : les comptes appartiennent à Max, et se
          règlent dans l'écran Réseaux. Ne restent au technique que les
          secrets de l'infrastructure et les comptes autorisés.
        -->
        <h2>Sauvegarde</h2>
        <p class="hint">
          L'export est une archive zip : les données en JSON, les articles en Markdown lisibles
          tels quels, et un LISEZ-MOI. Les jetons tiers n'y figurent jamais.
        </p>
        <div class="cluster">
          <a class="btn btn-primary" href="/api/admin/export">Télécharger une sauvegarde</a>
          <label class="btn">
            {{ importState === 'en cours' ? 'Lecture…' : 'Simuler un import (JSON)' }}
            <input
              type="file"
              accept="application/json"
              style="display: none"
              @change="stub"
            />
          </label>
        </div>
        <p v-if="importMessage" :class="importState === 'échec' ? 'err' : 'hint'">
          {{ importMessage }}
        </p>

        <h2>Comptes autorisés</h2>
        <ul class="list">
          <li v-for="c in accounts ?? []" :key="c.id">
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
