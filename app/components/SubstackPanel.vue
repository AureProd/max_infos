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
    failure.value = (e as { statusMessage?: string }).statusMessage ?? 'Le rapatriement a échoué'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <button class="btn" type="button" @click="open = !open">
      {{ open ? 'Fermer' : 'Rapatrier depuis Substack' }}
    </button>

    <section v-if="open" class="admin-page" style="margin-top: 16px">
      <h2>Rapatrier depuis Substack</h2>
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
          <button class="btn" type="submit" :disabled="busy">
            {{ busy ? 'Lecture…' : 'Simuler' }}
          </button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="busy || !report?.dryRun"
            :title="report?.dryRun ? '' : 'Simule d’abord : tu verras ce qui serait écrit.'"
            @click="run(false)"
          >
            Rapatrier
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
</template>
