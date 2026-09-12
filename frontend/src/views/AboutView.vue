<script setup>
import { SITE } from '@/data/site'
import { ARTICLES } from '@/data/content'
</script>

<template>
  <div class="wrap">
    <section class="about">
      <div class="about-grid">
        <div>
          <h1>À propos</h1>
          <p class="lede">
            Je m'appelle {{ SITE.author }}. J'écris « {{ SITE.name }} », des articles de fond sur le
            pouvoir, la mémoire et les identités — ce que le fil d'actualité n'a pas le temps
            d'expliquer.
          </p>
          <p>
            Chaque sujet suit le même trajet : une enquête publiée en format long dans la
            newsletter, une version condensée sur LinkedIn pour celles et ceux qui lisent entre deux
            réunions, et un visuel sur Instagram pour donner envie d'ouvrir le texte entier. Ce site
            rassemble les trois au même endroit.
          </p>
          <p>
            {{ ARTICLES.length }} articles publiés à ce jour. Rien n'est sponsorisé, rien n'est
            affilié, et ce site ne dépose aucun traceur.
          </p>
        </div>

        <div class="skills">
          <div v-for="set in SITE.skills" :key="set.group" class="skillset">
            <h4>{{ set.group }}</h4>
            <div class="chips">
              <span v-for="item in set.items" :key="item" class="chip">{{ item }}</span>
            </div>
          </div>
          <div class="skillset">
            <h4>Ailleurs</h4>
            <div class="links">
              <a
                v-for="link in SITE.links"
                :key="link.label"
                :href="link.href"
                target="_blank"
                rel="noopener"
              >
                {{ link.label }}<span>{{ link.value }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
