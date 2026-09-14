<script setup lang="ts">
const { data: site } = await useSite()
const { data: liste } = await useFetch('/api/articles', { key: 'a-propos', query: { taille: 1 } })

const liens = computed(() => site.value?.contact.fields.filter((f) => f.visible) ?? [])

/** Les identifiants de média sont résolus par /api/site ; ici on ne fait que lire. */
const medias = computed(() => site.value?.medias ?? {})
const photo = computed(() => {
  const id = site.value?.cv.photoMediaId
  return id ? (medias.value[id] ?? null) : null
})
const pdf = computed(() => {
  const id = site.value?.cv.pdfMediaId
  return id ? (medias.value[id] ?? null) : null
})

useSeoMeta({
  title: 'À propos',
  description: () => `${site.value?.identity.author} — ${site.value?.identity.tagline}`,
})
</script>

<template>
  <div class="wrap">
    <section class="about">
      <div class="about-grid">
        <div>
          <h1>À propos</h1>
          <img
            v-if="photo"
            class="portrait"
            :src="photo.url"
            :alt="photo.alt ?? `Portrait de ${site?.identity.author}`"
            loading="lazy"
          />
          <p class="lede">
            Je m'appelle {{ site?.identity.author }}. J'écris « {{ site?.identity.name }} », des
            articles de fond sur le pouvoir, la mémoire et les identités — ce que le fil
            d'actualité n'a pas le temps d'expliquer.
          </p>
          <p>
            Chaque sujet suit le même trajet : une enquête publiée en format long dans la
            newsletter, une version condensée sur LinkedIn pour celles et ceux qui lisent entre
            deux réunions, et un visuel sur Instagram pour donner envie d'ouvrir le texte entier.
            Ce site rassemble les trois au même endroit.
          </p>
          <p>
            {{ liste?.total ?? 0 }} articles publiés à ce jour. Rien n'est sponsorisé, rien n'est
            affilié, et ce site ne dépose aucun traceur.
          </p>
          <p v-if="pdf">
            <a class="btn" :href="pdf.url" download>Télécharger le CV (PDF)</a>
          </p>
        </div>

        <div class="skills">
          <div v-for="set in site?.cv.skills ?? []" :key="set.group" class="skillset">
            <h4>{{ set.group }}</h4>
            <div class="chips">
              <span v-for="item in set.items" :key="item" class="chip">{{ item }}</span>
            </div>
          </div>
          <div class="skillset">
            <h4>Ailleurs</h4>
            <div class="links">
              <a
                v-for="lien in liens"
                :key="lien.key"
                :href="lien.href"
                target="_blank"
                rel="noopener"
              >
                {{ lien.label }}<span>{{ lien.value }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.portrait {
  float: right;
  width: 140px;
  height: 175px;
  object-fit: cover;
  border-radius: 4px;
  margin: 0 0 12px 20px;
}
@media (max-width: 560px) {
  .portrait {
    float: none;
    margin: 0 0 16px;
  }
}
</style>
