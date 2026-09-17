<script setup lang="ts">
/**
 * Housekeeping the subjects.
 *
 * Nothing ever removed one, and nothing could correct one: every misspelling
 * added a subject, carried for good by the articles bearing it, and the list
 * of filters on the home page grew with its own mistakes.
 *
 * Renaming is offered on every subject; deleting only on those no article
 * carries — elsewhere it would mean stripping the subject off articles,
 * which nobody asks for from this screen.
 */
const open = ref(false)
const { data: tags, refresh } = await useFetch('/api/admin/tags', {
  key: 'sujets-gestion',
  immediate: false,
})

watch(open, (shown) => {
  if (shown) refresh()
})

const busy = ref(false)
const failure = ref('')

/** The subject being renamed, and what it is being renamed to. */
const editing = ref<string | null>(null)
const draft = ref('')

function start(slug: string, label: string): void {
  editing.value = slug
  draft.value = label
  failure.value = ''
}

async function run(action: () => Promise<unknown>): Promise<void> {
  busy.value = true
  failure.value = ''
  try {
    await action()
    await refresh()
  } catch (e) {
    failure.value = (e as { statusMessage?: string }).statusMessage ?? 'Opération refusée'
  } finally {
    busy.value = false
  }
}

function rename(slug: string): void {
  const label = draft.value.trim()
  if (!label) return
  void run(async () => {
    // `$fetch<unknown>`: the answer is not read, a refresh carries the new
    // state. Written otherwise, Nitro's route inference explodes on
    // « Excessive stack depth » — the trap UsersPanel.vue already records.
    await $fetch<unknown>(`/api/admin/tags/${slug}`, { method: 'PUT', body: { label } })
    editing.value = null
  })
}

function drop(slug: string, label: string): void {
  if (!confirm(`Supprimer définitivement le sujet « ${label} » ?`)) return
  void run(() => $fetch<unknown>(`/api/admin/tags/${slug}`, { method: 'DELETE' }))
}
</script>

<template>
  <Button severity="secondary" outlined label="Sujets" @click="open = true" />

  <Dialog v-model:visible="open" modal header="Sujets de recherche" :style="{ width: '40rem' }">
    <p class="hint">
      Ce sont les filtres proposés sur l'accueil. Renommer un sujet corrige aussi son adresse :
      un lien vers l'ancienne cessera de filtrer. Un sujet ne s'efface que si aucun article ne
      le porte.
    </p>

    <p v-if="failure" class="a-err">{{ failure }}</p>

    <DataTable :value="tags ?? []" data-key="slug" size="small" striped-rows sort-field="label" :sort-order="1">
      <template #empty>
        <p class="a-empty">Aucun sujet pour l'instant.</p>
      </template>

      <Column field="label" header="Sujet" sortable>
        <template #body="{ data }">
          <div v-if="editing === data.slug" class="a-toolbar">
            <InputText v-model="draft" autofocus @keydown.enter.prevent="rename(data.slug)" />
            <Button size="small" label="Renommer" :disabled="busy" @click="rename(data.slug)" />
            <Button
              severity="secondary"
              text
              size="small"
              label="Annuler"
              @click="editing = null"
            />
          </div>
          <template v-else>
            <span class="a-title">{{ data.label }}</span>
            <div class="a-sub"><span>/{{ data.slug }}</span></div>
          </template>
        </template>
      </Column>

      <Column field="n" header="Articles" sortable style="width: 110px">
        <template #body="{ data }">
          <Tag :value="String(data.n)" :severity="data.n === 0 ? 'warn' : 'success'" />
        </template>
      </Column>

      <Column style="width: 1%">
        <template #body="{ data }">
          <div v-if="editing !== data.slug" class="a-row-act">
            <Button
              severity="secondary"
              outlined
              size="small"
              label="Renommer"
              :disabled="busy"
              @click="start(data.slug, data.label)"
            />
            <!--
              Seulement sur un sujet orphelin : ailleurs, supprimer voudrait
              dire le retirer des articles qui le portent.
            -->
            <Button
              v-if="data.n === 0"
              severity="danger"
              outlined
              size="small"
              label="Supprimer"
              :disabled="busy"
              @click="drop(data.slug, data.label)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <template #footer>
      <Button label="Fermer" @click="open = false" />
    </template>
  </Dialog>
</template>
