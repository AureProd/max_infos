<script setup lang="ts">
import { nb } from '#shared/utils/format'

/**
 * Les accounts Instagram, une section chacun.
 *
 * Tout vient d'une seule réponse : les accounts que Max a chosen d'afficher,
 * dans l'ordre qu'il a fixé, chacun tronqué au nombre de publications qu'il
 * a chosen. Le name, la photo et la bio sont ceux du account tel qu'Instagram
 * les donne — plus rien n'est écrit à la main, donc plus rien ne peut être
 * falsy.
 *
 * Les compteurs passent par `nb()`, jamais par `toLocaleString` : `Intl`
 * rend U+202F ou U+00A0 selon l'ICU embarquée, et l'hydratation casse.
 */
const { data: accounts } = await useFetch('/api/social-accounts', { key: 'comptes-sociaux-public' })
</script>

<template>
  <section v-for="account in accounts ?? []" :key="account.id" class="section">
    <div class="igp-head">
      <div class="igp-avatar">
        <div class="in">
          <img v-if="account.avatarUrl" :src="account.avatarUrl" :alt="`@${account.username}`" />
        </div>
      </div>
      <div class="igp-id">
        <a class="igp-handle" :href="account.url ?? undefined" target="_blank" rel="noopener">
          @{{ account.username }}
          <span class="igp-follow">Suivre</span>
        </a>
        <div class="igp-stats">
          <span
            ><b>{{ nb(account.mediaCount ?? account.publications.length) }}</b> publications</span
          >
          <span v-if="account.followers"
            ><b>{{ nb(account.followers) }}</b> abonné(e)s</span
          >
        </div>
        <p v-if="account.biography" class="igp-bio">{{ account.biography }}</p>
      </div>
    </div>

    <div class="section-head">
      <h2>{{ account.displayName ?? `Sur @${account.username}` }}</h2>
      <span class="rule" />
      <a class="note" :href="account.url ?? undefined" target="_blank" rel="noopener">
        Voir le compte ↗
      </a>
    </div>

    <!--
      Cartes maison plutôt que l'embed officiel : Instagram le sert en thème
      CLAIR, sans moyen de le changer, ce qui produisait des blocs blancs au
      milieu d'un site sombre. La carte est dessinée avec le CSS du site à
      partir des données de l'API.
    -->
    <ul class="pubs">
      <li v-for="item in account.publications" :key="item.id">
        <PublicationCard :publication="item" />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.igp-avatar .in img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
