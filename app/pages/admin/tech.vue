<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })

const { peut } = useUser()
const seesTech = peut('tech')

const importState = ref<'repos' | 'en cours' | 'échec'>('repos')
const importMessage = ref('')

/**
 * Restoring a backup — the very zip the button above hands out.
 *
 * It used to accept raw JSON only, so what the site produced could not be
 * fed back to it: pulling the production content into a local database was
 * simply impossible. Now the archive goes back in as it came out.
 */
const PARTS = [
  { key: 'articles', label: 'Articles et sujets' },
  { key: 'media', label: 'Images et documents' },
  { key: 'publications', label: 'Comptes et publications' },
  { key: 'settings', label: 'Réglages (à propos, CV, gabarits)' },
  { key: 'users', label: 'Comptes autorisés' },
  { key: 'views', label: 'Compteurs de lecture' },
]

const chosen = ref<string[]>(PARTS.map((p) => p.key))
const wipe = ref(true)
const archive = ref<File | null>(null)
/** What the dry run said, and therefore what « Restaurer » may be offered. */
const preview = ref<{ before: unknown; after: unknown } | null>(null)

function pick(event: Event): void {
  archive.value = (event.target as HTMLInputElement).files?.[0] ?? null
  preview.value = null
  importMessage.value = ''
  importState.value = 'repos'
}

/** `parts=` and the two switches, as the route reads them from the query. */
const query = (dryRun: boolean): string =>
  `?dryRun=${dryRun}&wipe=${wipe.value}&parts=${chosen.value.join(',')}`

async function send(dryRun: boolean): Promise<void> {
  const file = archive.value
  if (!file) return
  importState.value = 'en cours'
  importMessage.value = ''
  try {
    const bytes = await file.arrayBuffer()
    const json = file.name.endsWith('.json')

    const summary = json
      ? await $fetch('/api/admin/import', {
          method: 'POST',
          body: { archive: JSON.parse(new TextDecoder().decode(bytes)), dryRun, wipe: wipe.value },
        })
      : await $fetch(`/api/admin/import${query(dryRun)}`, {
          method: 'POST',
          body: bytes,
          headers: { 'content-type': 'application/zip' },
        })

    importState.value = 'repos'
    if ('dryRun' in summary && summary.dryRun) {
      preview.value = { before: summary.before, after: summary.after }
      importMessage.value = ''
    } else {
      preview.value = null
      importMessage.value = `Restauré : ${JSON.stringify('written' in summary ? summary.written : {})}`
    }
  } catch (e) {
    importState.value = 'échec'
    preview.value = null
    importMessage.value = (e as { statusMessage?: string }).statusMessage ?? 'Archive illisible'
  }
}

/**
 * A dry run ALWAYS comes first.
 *
 * Restoring overwrites the content: offering the button without showing the
 * difference would amount to asking someone to sign without reading.
 */
async function restore(): Promise<void> {
  const what = wipe.value
    ? 'REMPLACER le contenu actuel par celui de l’archive'
    : 'ajouter le contenu de l’archive à celui qui est en base'
  if (!confirm(`Cette opération va ${what}. Elle est définitive. Continuer ?`)) return
  await send(false)
}

const counts = (value: unknown): string =>
  Object.entries((value ?? {}) as Record<string, number>)
    .map(([k, n]) => `${k} : ${n}`)
    .join(' · ')

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
            {{ archive ? archive.name : 'Choisir une archive…' }}
            <input type="file" accept=".zip,.json" style="display: none" @change="pick" />
          </label>
        </div>

        <template v-if="archive">
          <p class="hint" style="margin-top: 18px">
            Ce qui est restauré. Les images restent sur R2 : l'archive n'en porte que les
            références, donc une restauration locale affichera les mêmes adresses qu'en
            production. Les jetons tiers, eux, n'y figurent jamais — une connexion Instagram
            est à refaire.
          </p>

          <ul class="a-taglist">
            <li v-for="part in PARTS" :key="part.key">
              <Checkbox
                v-model="chosen"
                :input-id="`part-${part.key}`"
                :value="part.key"
              />
              <label :for="`part-${part.key}`">{{ part.label }}</label>
            </li>
          </ul>

          <label class="a-switch" style="margin-top: 12px">
            <ToggleSwitch v-model="wipe" />
            <span>
              {{
                wipe
                  ? 'Vider ce qui est restauré avant d’écrire'
                  : 'Ajouter à ce qui est déjà en base'
              }}
            </span>
          </label>

          <div class="cluster" style="margin-top: 16px">
            <Button
              severity="secondary"
              outlined
              :label="importState === 'en cours' ? 'Lecture…' : 'Simuler'"
              :disabled="importState === 'en cours' || !chosen.length"
              @click="send(true)"
            />
            <Button
              severity="danger"
              :label="'Restaurer'"
              :disabled="importState === 'en cours' || !preview || !chosen.length"
              @click="restore"
            />
          </div>

          <!--
            Le refus se lit là où l'on vient de cliquer. En pied d'écran, il
            passait inaperçu — et une restauration qui échoue sans se voir
            laisse croire qu'elle a réussi.
          -->
          <p v-if="importMessage" :class="importState === 'échec' ? 'a-err' : 'hint'">
            {{ importMessage }}
          </p>

          <!--
            Les deux décomptes côte à côte : c'est la seule façon de voir ce
            qu'on s'apprête à perdre avant de cliquer.
          -->
          <div v-if="preview" class="a-diff">
            <p><strong>En base :</strong> {{ counts(preview.before) }}</p>
            <p><strong>Dans l'archive :</strong> {{ counts(preview.after) }}</p>
          </div>
        </template>

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
