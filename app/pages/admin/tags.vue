<script setup lang="ts">
/**
 * Housekeeping the tags.
 *
 * Nothing ever removed one, and nothing could correct one: every misspelling
 * added a tag, carried for good by the articles bearing it, and the list of
 * filters on the home page grew with its own mistakes.
 *
 * It was a dialog opened from the article list — which made a whole class of
 * content feel like a setting of another screen. Tags are what a reader
 * navigates the site by; they get a screen.
 *
 * Renaming is offered on every tag; deleting only on those no article
 * carries — elsewhere it would mean stripping the tag off articles, which
 * nobody asks for from here.
 */
definePageMeta({ middleware: 'admin', layout: 'admin' })

const { data: tags, refresh } = await useFetch('/api/admin/tags', { key: 'tags-gestion' })
const { ok, fail } = useNotify()
const confirm = useConfirm()

const busy = ref(false)
const search = ref('')

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (tags.value ?? []).filter((t) => !q || t.label.toLowerCase().includes(q))
})

const orphans = computed(() => (tags.value ?? []).filter((t) => t.n === 0).length)

/** The tag being renamed, and what it is being renamed to. */
const editing = ref<string | null>(null)
const draft = ref('')

function start(slug: string, label: string): void {
  editing.value = slug
  draft.value = label
}

async function run(action: () => Promise<unknown>, said: string): Promise<void> {
  busy.value = true
  try {
    await action()
    await refresh()
    ok(said)
  } catch (e) {
    fail(e, 'Opération refusée')
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
  }, 'Tag renommé')
}

function drop(slug: string, label: string): void {
  confirm.require({
    header: 'Supprimer ce tag',
    message: `« ${label} » sera supprimé définitivement.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer',
    acceptProps: { severity: 'danger' },
    rejectLabel: 'Annuler',
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      run(() => $fetch<unknown>(`/api/admin/tags/${slug}`, { method: 'DELETE' }), 'Tag supprimé'),
  })
}

useSeoMeta({ title: 'Tags', robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <div class="admin-title">
      <div>
        <h1>Tags</h1>
        <p class="admin-lede">
          {{ (tags ?? []).length }} au total · {{ orphans }} sans article
        </p>
      </div>
    </div>

    <div class="admin-card">
      <p class="hint">
        Ce sont les filtres proposés sur l'accueil, les plus portés en premier. Renommer un tag
        change aussi son adresse : un lien vers l'ancienne cessera de filtrer.
      </p>

      <div class="a-toolbar">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="search" placeholder="Rechercher un tag…" />
        </IconField>
      </div>

      <div class="a-scroll-x">
        <DataTable
          :value="rows"
          data-key="slug"
          size="small"
          striped-rows
          sort-field="n"
          :sort-order="-1"
        >
          <template #empty>
            <p class="a-empty">Aucun tag ne correspond.</p>
          </template>

          <Column field="label" header="Tag" sortable :pt="cell('Tag')">
            <template #body="{ data }">
              <div v-if="editing === data.slug" class="a-toolbar">
                <InputText v-model="draft" autofocus @keydown.enter.prevent="rename(data.slug)" />
                <Button
                  size="small"
                  icon="pi pi-check"
                  label="Renommer"
                  :disabled="busy"
                  @click="rename(data.slug)"
                />
                <Button
                  severity="secondary"
                  text
                  size="small"
                  icon="pi pi-times"
                  aria-label="Annuler"
                  @click="editing = null"
                />
            </div>
              <template v-else>
                <span class="a-title">{{ data.label }}</span>
                <div class="a-sub"><span>/{{ data.slug }}</span></div>
              </template>
            </template>
          </Column>

          <Column field="n" header="Articles" sortable class="a-col-sm" :pt="cell('Articles')">
            <template #body="{ data }">
              <Tag :value="String(data.n)" :severity="data.n === 0 ? 'warn' : 'success'" />
            </template>
          </Column>

          <Column class="a-col-fit" :pt="cell('')">
            <template #body="{ data }">
              <div v-if="editing !== data.slug" class="a-row-act">
                <Button
                  v-tooltip.top="'Renommer'"
                  severity="secondary"
                  outlined
                  size="small"
                  icon="pi pi-pencil"
                  aria-label="Renommer"
                  :disabled="busy"
                  @click="start(data.slug, data.label)"
                />
                <!--
                  Seulement sur un tag orphelin : ailleurs, supprimer voudrait
                  dire le retirer des articles qui le portent.
                -->
                <Button
                  v-if="data.n === 0"
                  v-tooltip.top="'Supprimer'"
                  severity="danger"
                  outlined
                  size="small"
                  icon="pi pi-trash"
                  aria-label="Supprimer"
                  :disabled="busy"
                  @click="drop(data.slug, data.label)"
                />
            </div>
            </template>
          </Column>
          </DataTable>
      </div>
    </div>
  </div>
</template>
