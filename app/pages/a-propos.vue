<script setup lang="ts">
const { data: site } = await useSite()
const { data: liste } = await useFetch('/api/articles', { key: 'a-propos', query: { taille: 1 } })

const liens = computed(() => site.value?.contact.fields.filter((f) => f.visible) ?? [])

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
