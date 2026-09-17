<script setup lang="ts">
/**
 * Repatriating the Substack publication.
 *
 * A dry run FIRST, always: it says what would be written and touches
 * nothing. Importing is not something you run twice out of curiosity.
 *
 * What it creates are DRAFTS. The body is converted from the HTML the feed
 * gives, which is good enough to read and not good enough to publish
 * unreviewed — so nothing here can put unread markup in front of readers.
 */

const { data: site } = await useSite()

const feedUrl = ref('')
watchEffect(() => {
  // Typed once: the address is remembered in the settings, and comes back
  // through the public payload of the site.
  if (!feedUrl.value) feedUrl.value = site.value?.substack?.feedUrl ?? ''
})

type Report = {
  dryRun: boolean
  linked: number
  covers: number
  untouched: number
  created: { slug: string; title: string }[]
}

const open = ref(false)
const busy = ref(false)
const failure = ref('')
const report = ref<Report | null>(null)

const emit = defineEmits<{ imported: [] }>()

async function run(dryRun: boolean): Promise<void> {
  busy.value = true
  failure.value = ''
  try {
    report.value = await $fetch<Report>('/api/admin/substack/import', {
      method: 'POST',
      body: { feedUrl: feedUrl.value, dryRun },
    })
    if (!dryRun) emit('imported')
  } catch (e) {
    report.value = null
    /*
     * Read from `data`, the JSON body of the error.
     *
     * ofetch maps `statusMessage` onto `statusText`, which HTTP/2 does not
     * carry: behind Traefik the panel showed « Le rapatriement a échoué »
     * whatever the real cause — wrong address, feed answering 404, HTML
     * instead of RSS.
     */
    const err = e as { data?: { message?: string; statusMessage?: string }; message?: string }
    failure.value = err.data?.message ?? err.data?.statusMessage ?? 'Le rapatriement a échoué'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <Button
      severity="secondary"
      outlined
      :icon="open ? 'pi pi-times' : 'pi pi-download'"
      :label="open ? 'Fermer' : 'Importer'"
      @click="open = !open"
    />

    <!--
      Téléporté : le bouton vit dans la barre d'actions de l'écran, une
      rangée en flex. Le panneau ouvert à cet endroit la déformait et
      poussait le titre de la page de côté.
    -->
    <Teleport to="body">
      <div v-if="open" class="sp-backdrop" @click.self="open = false">
        <section class="sp-box admin-ui">
          <header class="sp-head">
            <h2>Importer depuis Substack</h2>
            <button class="a-btn" type="button" @click="open = false">Fermer ✕</button>
          </header>
      <p class="hint">
        Les billets déjà présents ici récupèrent leur lien d’origine et leur couverture — leur
        texte n’est jamais réécrit. Les autres arrivent en <strong>brouillon</strong>, corps
        converti, à relire avant publication.
      </p>

      <form class="field" @submit.prevent="run(true)">
        <label for="s-feed">Adresse du flux</label>
        <div class="cluster">
          <input
            id="s-feed"
            v-model="feedUrl"
            type="url"
            required
            placeholder="https://exemple.substack.com/feed"
          />
          <button class="a-btn" type="submit" :disabled="busy">
            {{ busy ? 'Lecture…' : 'Voir ce qui serait importé' }}
          </button>
          <button
            class="a-btn a-btn-primary"
            type="button"
            :disabled="busy || !report?.dryRun"
            :title="report?.dryRun ? '' : 'Simule d’abord : tu verras ce qui serait écrit.'"
            @click="run(false)"
          >
            Importer
          </button>
        </div>
      </form>

      <p v-if="failure" class="err">{{ failure }}</p>

      <template v-if="report">
        <p class="hint">
          {{ report.dryRun ? 'Rien n’a été écrit.' : 'Rapatriement appliqué.' }}
          {{ report.linked }} lien(s), {{ report.covers }} couverture(s),
          {{ report.created.length }} brouillon(s), {{ report.untouched }} billet(s) déjà à jour.
        </p>
        <ul v-if="report.created.length" class="list">
          <li v-for="c in report.created" :key="c.slug">
            <div class="entry">
              <div>
                <h3>
                  <NuxtLink v-if="!report.dryRun" :to="`/admin/${c.slug}`">{{ c.title }}</NuxtLink>
                  <template v-else>{{ c.title }}</template>
                </h3>
                <div class="meta">
                  <span class="pill">brouillon</span>
                  <span>{{ c.slug }}</span>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </template>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.sp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: clamp(12px, 4vw, 24px);
  background: rgba(15, 18, 22, 0.5);
}
.sp-box {
  width: min(680px, 100%);
  max-height: min(82dvh, 100%);
  overflow-y: auto;
  padding: 0 clamp(14px, 4vw, 22px) 22px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}
.sp-head {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 0 14px;
  background: #fff;
  border-bottom: 1px solid #e2e5ea;
  margin-bottom: 16px;
}
.sp-head h2 {
  margin: 0;
  font-size: 1.05rem;
}
</style>
