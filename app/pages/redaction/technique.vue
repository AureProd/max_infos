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

const importEtat = ref<'repos' | 'en cours' | 'échec'>('repos')
const importMessage = ref('')

/**
 * L'import se fait TOUJOURS en simulation d'abord.
 *
 * Restaurer une sauvegarde écrase le contenu : proposer le bouton sans
 * montrer le différentiel reviendrait à demander à quelqu'un de signer
 * sans lire.
 */
async function simuler(evenement: Event): Promise<void> {
  const fichier = (evenement.target as HTMLInputElement).files?.[0]
  if (!fichier) return
  importEtat.value = 'en cours'
  importMessage.value = ''
  try {
    const archive = JSON.parse(await fichier.text())
    const bilan = await $fetch('/api/admin/import', {
      method: 'POST',
      body: { archive, simulation: true },
    })
    importEtat.value = 'repos'
    importMessage.value =
      'simulation' in bilan && bilan.simulation
        ? `En base : ${JSON.stringify(bilan.avant)} — dans l'archive : ${JSON.stringify(bilan.apres)}`
        : 'Import appliqué.'
  } catch (e) {
    importEtat.value = 'échec'
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

      <p v-if="!voitLaTechnique" class="empty">
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
            {{ importEtat === 'en cours' ? 'Lecture…' : 'Simuler un import (JSON)' }}
            <input
              type="file"
              accept="application/json"
              style="display: none"
              @change="simuler"
            />
          </label>
        </div>
        <p v-if="importMessage" :class="importEtat === 'échec' ? 'err' : 'hint'">
          {{ importMessage }}
        </p>

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
