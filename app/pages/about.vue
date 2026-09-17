<script setup lang="ts">
const { data: site } = await useSite()
const { data: list } = await useFetch('/api/articles', { key: 'a-propos', query: { size: 1 } })

/**
 * The switches are applied by /api/site, before the answer leaves. What
 * arrives here is already what may be shown — the page no longer decides.
 */
const links = computed(() => site.value?.contact.fields ?? [])

/** Media identifiers are resolved by /api/site; here we only read. */
const mediaItems = computed(() => site.value?.mediaItems ?? {})
const photo = computed(() => {
  const id = site.value?.cv.photoMediaId
  return id ? (mediaItems.value[id] ?? null) : null
})
const pdf = computed(() => {
  const id = site.value?.cv.pdfMediaId
  return id ? (mediaItems.value[id] ?? null) : null
})

/**
 * The CV sections, in the order of the back-office screen.
 *
 * The page used to render `cv.skills` and NOTHING else — a field no admin
 * screen ever writes. Everything Max actually typed, his education and his
 * engagements, appeared nowhere on the site.
 */
const SECTIONS = [
  { key: 'education' as const, label: 'Formations' },
  { key: 'experience' as const, label: 'Expériences' },
  { key: 'engagements' as const, label: 'Engagements' },
]

type Entry = { title: string; org?: string; start?: string; end?: string; detail?: string }
type Block = { label: string; entries?: Entry[]; items?: string[] }

/**
 * One list for everything the CV holds, dated entries and chips alike: the
 * page lays them out the same way, and an empty rubric simply is not there.
 */
const blocks = computed<Block[]>(() => {
  const cv = site.value?.cv
  if (!cv) return []

  const out: Block[] = SECTIONS.map((s) => ({ label: s.label, entries: cv[s.key].entries })).filter(
    (b) => (b.entries?.length ?? 0) > 0,
  )

  for (const set of cv.skills)
    if (set.items.length) out.push({ label: set.group, items: set.items })

  if (cv.languages.length)
    out.push({
      label: 'Langues',
      items: cv.languages.map((l) => (l.level ? `${l.label} — ${l.level}` : l.label)),
    })
  if (cv.certifications.length) out.push({ label: 'Certifications', items: cv.certifications })
  if (cv.interests.length) out.push({ label: "Centres d'intérêt", items: cv.interests })

  return out
})

/** « 2024 – 2026 », « depuis 2024 », or nothing at all. */
function period(entry: { start?: string; end?: string }): string {
  const { start, end } = entry
  if (start && end) return `${start} – ${end}`
  if (start) return `depuis ${start}`
  return end ?? ''
}

useSeoMeta({
  title: 'À propos',
  description: () => `${site.value?.identity.author} — ${site.value?.identity.tagline}`,
})
</script>

<template>
  <div class="wrap">
    <section class="about">
      <!--
        Deux temps plutôt que deux colonnes jusqu'en bas. Le texte est
        court et le CV long : tout empiler à droite creusait un vide de la
        hauteur de l'écran à gauche. Les rubriques passent donc sous le
        texte, en autant de colonnes que la largeur en autorise, et la page
        tient aussi bien avec trois lignes de CV qu'avec trente.
      -->
      <div class="about-grid">
        <div>
          <h1>À propos</h1>
          <p v-if="site?.cv.headline" class="headline">{{ site.cv.headline }}</p>
          <p v-if="site?.cv.intro" class="lede">{{ site.cv.intro }}</p>
          <p v-else class="lede">
            Je m'appelle {{ site?.identity.author }}. J'écris « {{ site?.identity.name }} », des
            articles de fond sur le pouvoir, la mémoire et les identités — ce que le fil
            d'actualité n'a pas le temps d'expliquer.
          </p>
          <p>
            Chaque tag suit le même trajet : une enquête publiée en format long dans la
            newsletter, une version condensée sur LinkedIn pour celles et ceux qui lisent entre
            deux réunions, et un visuel sur Instagram pour donner envie d'ouvrir le texte entier.
            Ce site rassemble les trois au même endroit.
          </p>
          <p>
            {{ list?.total ?? 0 }} articles publiés à ce jour. Rien n'est sponsorisé, rien n'est
            affilié, et ce site ne dépose aucun traceur.
          </p>
          <p v-if="pdf">
            <a class="btn" :href="pdf.url" download>Télécharger le CV (PDF)</a>
          </p>
        </div>

        <aside class="about-side">
          <img
            v-if="photo"
            class="portrait"
            :src="photo.url"
            :alt="photo.alt ?? `Portrait de ${site?.identity.author}`"
            loading="lazy"
          />
          <div v-if="links.length" class="skillset">
            <h4>Ailleurs</h4>
            <div class="links">
              <a
                v-for="link in links"
                :key="link.key"
                :href="link.href"
                target="_blank"
                rel="noopener"
              >
                {{ link.label }}<span>{{ link.value }}</span>
              </a>
            </div>
          </div>
        </aside>
      </div>

      <div v-if="blocks.length" class="cvgrid">
        <div v-for="block in blocks" :key="block.label" class="skillset">
          <h4>{{ block.label }}</h4>

          <ul v-if="block.entries" class="cvlist">
            <li v-for="(e, i) in block.entries" :key="i">
              <span class="cv-title">{{ e.title }}</span>
              <span v-if="e.org" class="cv-org">{{ e.org }}</span>
              <span v-if="period(e)" class="cv-when">{{ period(e) }}</span>
              <span v-if="e.detail" class="cv-detail">{{ e.detail }}</span>
            </li>
          </ul>

          <div v-else class="chips">
            <span v-for="item in block.items" :key="item" class="chip">{{ item }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.about-side {
  display: flex;
  flex-direction: column;
  gap: 26px;
}
.portrait {
  width: 100%;
  max-width: 220px;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  border-radius: 4px;
}
.headline {
  margin: -14px 0 20px;
  font-family: var(--display);
  font-size: 0.92rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
/*
  Trois colonnes, fixées. En `auto-fill`, la largeur décidait du nombre :
  six rubriques tombaient en 4 + 2, avec une deuxième ligne en lambeaux.
  Trois donne 3 + 3, et le compte reste lisible d'un coup d'oeil.
*/
.cvgrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 38px 40px;
  margin-top: 56px;
  padding-top: 40px;
  border-top: 1px solid var(--line);
}
.cvlist {
  list-style: none;
  margin: 0;
  padding: 0;
}
.cvlist li {
  display: grid;
  gap: 2px;
  padding: 10px 0;
  border-top: 1px solid var(--line-soft);
}
.cvlist li:first-child {
  border-top: 0;
  padding-top: 0;
}
.cv-title {
  font-weight: 600;
  line-height: 1.35;
  color: var(--text);
}
.cv-org,
.cv-when,
.cv-detail {
  font-size: 0.9rem;
  line-height: 1.45;
  color: var(--muted);
}
@media (max-width: 900px) {
  .cvgrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .cvgrid {
    grid-template-columns: minmax(0, 1fr);
    margin-top: 40px;
  }
}
</style>
