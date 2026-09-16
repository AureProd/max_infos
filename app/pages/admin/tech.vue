<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })

const { peut } = useUser()
const seesTech = peut('tech')

const importState = ref<'repos' | 'en cours' | 'échec'>('repos')
const importMessage = ref('')

/**
 * An import ALWAYS runs as a dry run first.
 *
 * Restoring a backup overwrites the content: offering the button without
 * showing the difference would amount to asking someone to sign without
 * reading.
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
      body: { archive, dryRun: true },
    })
    importState.value = 'repos'
    importMessage.value =
      'dryRun' in summary && summary.dryRun
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
  <div>

    <div class="admin-title">
      <div>
        <h1>Technique</h1>
        <p class="admin-lede">
          La sauvegarde et les comptes autorisés. Les comptes Instagram, eux, se règlent
          dans l'écran Réseaux.
        </p>
      </div>
    </div>

    <p v-if="!seesTech" class="a-empty">Cet écran est réservé au rôle technique.</p>

    <template v-else>
        <!--
          Instagram n'est plus ici : les comptes appartiennent à Max, et se
          règlent dans l'écran Réseaux. Ne restent au technique que les
          secrets de l'infrastructure et les comptes autorisés.
        -->
      <section class="field-group">
        <h2 style="margin-top: 0">Sauvegarde</h2>
        <p class="hint">
          L'export est une archive zip : les données en JSON, les articles en Markdown lisibles
          tels quels, et un LISEZ-MOI. Les jetons tiers n'y figurent jamais.
        </p>
        <div class="cluster">
          <a class="a-btn a-btn-primary" href="/api/admin/export">Télécharger une sauvegarde</a>
          <label class="a-btn">
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
      </section>

        <!--
          The accounts moved into their own component: this screen already
          carries backups and imports, and the list is no longer a list — it
          invites, promotes, cuts off and deletes.
        -->
        <UsersPanel />
      </template>
  </div>
</template>
